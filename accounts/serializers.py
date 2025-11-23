from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from django.utils.crypto import get_random_string
from .models import FixedDeposit, InvestmentLoan, OutstandingBalance, Savings, SavingsPenalty, User, Member, NextOfKin, Payment, CooperativeGroup
from .models import ContributionPlan, Transaction, MemberContribution, ManualPayment, Loan, LoanPayment
from django.db import transaction as db_transaction
from django.utils import timezone

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'group', 'first_name', 'last_name', 'role', 'phone', 'address')
        read_only_fields = ('id', 'role')

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CooperativeGroup
        fields = '__all__'

class NextOfKinSerializer(serializers.ModelSerializer):
    class Meta:
        model = NextOfKin
        fields = '__all__'

class MemberSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    
    # RETAIN OTHER FIELDS
    next_of_kin = NextOfKinSerializer(read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    # CARD NUMBER (Keep this writable if admins are inputting it)
    card_number = serializers.CharField(max_length=10, required=False)
    
    class Meta:
        model = Member
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    payment_type = serializers.CharField(source='manual_payment.payment_type', read_only=True)
    bank_name = serializers.CharField(source='manual_payment.bank_name', read_only=True)
    
    class Meta:
        model = Payment
        fields = '__all__'

# UPDATED: Manual Payment Serializers with new payment types
class ManualPaymentSerializer(serializers.ModelSerializer):
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_card_number = serializers.CharField(source='member.card_number', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.get_full_name', read_only=True)
    
    class Meta:
        model = ManualPayment
        fields = [
            'id', 'member', 'member_name', 'member_card_number', 'amount', 'payment_type',
            'group', 'group_name', 'status', 'reference_number', 'admin_notes',
            'created_at', 'confirmed_at', 'confirmed_by', 'confirmed_by_name',
            'bank_name', 'transaction_reference', 'transfer_date', 'date', 'time'
        ]
        read_only_fields = ['reference_number', 'created_at', 'confirmed_at', 'confirmed_by']

    def get_date(self, obj):
        """Return formatted date in YYYY-MM-DD format using LOCAL time"""
        if obj.created_at:
            # Convert to local time - THIS IS THE KEY FIX
            local_dt = timezone.localtime(obj.created_at)
            return local_dt.strftime('%Y-%m-%d')
        return None

    def get_time(self, obj):
        """Return properly formatted time in 12-hour format using LOCAL time"""
        if obj.created_at:
            # Convert to local time - THIS IS THE KEY FIX
            local_dt = timezone.localtime(obj.created_at)
            # Format time properly - this will give "10:00 AM" format
            return local_dt.strftime('%I:%M %p')
        return None

class ManualPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualPayment
        fields = ['amount', 'payment_type', 'bank_name', 'transaction_reference', 'transfer_date']
    
    def validate_amount(self, value):
        if value < 1100:
            raise serializers.ValidationError("Minimum contribution amount is ₦1100")
        return value

# NEW: Loan Serializers
class LoanPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanPayment
        fields = ['id', 'loan', 'amount', 'payment_type', 'week_number', 'is_pending', 
                 'paid_amount', 'paid_date', 'description', 'balance_after', 'created_at']

class LoanSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.get_full_name', read_only=True)
    member_card_number = serializers.CharField(source='member.card_number', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.get_full_name', read_only=True)
    payments = LoanPaymentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Loan
        fields = [
            'id', 'member', 'member_name', 'member_card_number', 'group',
            'loan_type', 'amount', 'amount_granted', 'remaining_balance',
            'interest_weeks', 'total_interest_added', 'pending_penalty', 
            'total_penalties_paid', 'first_interest_applied',
            'purpose', 'status', 'granted_by', 'granted_by_name',
            'granted_at', 'admin_notes', 'payments', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'member', 'group', 'amount_granted', 'remaining_balance',
            'interest_weeks', 'total_interest_added', 'pending_penalty',
            'total_penalties_paid', 'first_interest_applied',
            'granted_by', 'granted_at', 'created_at', 'updated_at'
        ]

class SavingsPenaltySerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.get_full_name', read_only=True)
    member_card_number = serializers.CharField(source='member.card_number', read_only=True)
    
    class Meta:
        model = SavingsPenalty
        fields = ['id', 'member', 'member_name', 'member_card_number', 'amount', 
                 'week_number', 'is_pending', 'paid_amount', 'paid_date', 'description', 'created_at']

class MemberSavingsSummarySerializer(serializers.ModelSerializer):
    total_savings_penalties_paid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    pending_savings_penalty = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    recent_savings_penalties = serializers.SerializerMethodField()
    
    class Meta:
        model = Member
        fields = [
            'id', 'user', 'card_number', 'pending_savings_penalty', 
            'total_savings_penalties_paid', 'recent_savings_penalties'
        ]
    
    def get_recent_savings_penalties(self, obj):
        penalties = obj.savings_penalties.order_by('-created_at')[:5]
        return SavingsPenaltySerializer(penalties, many=True).data

class ProcessPaymentSerializer(serializers.Serializer):
    payment_type = serializers.ChoiceField(choices=[
        ('savings', 'Savings'),
        ('outstanding_balance', 'Outstanding Balance'),
        ('investment_loan', 'Investment Loan')
    ])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1100)
    bank_name = serializers.CharField(required=False, allow_blank=True)
    transaction_reference = serializers.CharField(required=False, allow_blank=True)
    transfer_date = serializers.DateField(required=False)
class LoanCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = ['loan_type', 'amount', 'purpose', 'admin_notes']
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Loan amount must be greater than 0")
        return value

class MemberRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True,)
    card_number = serializers.CharField(write_only=True,)
    first_name = serializers.CharField(write_only=True)
    surname = serializers.CharField(write_only=True)
    phone = serializers.CharField()
    address = serializers.CharField(required=False, allow_blank=True)
    group = serializers.CharField(required=False, allow_blank=True)
    passport = serializers.ImageField(write_only=True, required=False, allow_null=True)
    kinName = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinSurname = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinPhone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinAddress = serializers.CharField(write_only=True, required=False, allow_blank=True)
    paymentConfirmed = serializers.BooleanField(write_only=True, required=False, default=True)
    
    class Meta:
        model = Member
        fields = ('email', 'card_number', 'first_name', 'surname', 'phone', 'address', 'group', 
                 'passport', 'kinName', 'kinSurname', 'kinPhone', 'kinAddress', 'paymentConfirmed')
    
    def validate_group(self, value):
        """
        Handle group validation - create group if it doesn't exist
        """
        if not value:
            return None
        try:
            # If value is already a group instance
            if isinstance(value, CooperativeGroup):
                return value

            # Try by ID
            if str(value).isdigit():
                return CooperativeGroup.objects.get(id=int(value))

            # Try by name (case insensitive)
            return CooperativeGroup.objects.get(name__iexact=value.strip())

        except CooperativeGroup.DoesNotExist:
            # If not found, create it automatically
            group = CooperativeGroup.objects.create(name=value.strip())
            print(f"✅ Created new group '{group.name}' automatically")
            return group
    
    def validate(self, data):
        group = self.validate_group(data.get('group'))
        card_number = data.get('card_number')

        if group and card_number:
            if Member.objects.filter(group=group, card_number=card_number).exists():
                raise serializers.ValidationError(
                    {"card_number": f"Card number '{card_number}' is already taken in group '{group.name}'."}
                )
        elif not group:
             raise serializers.ValidationError(
                    {"group": "Group is required for a member."}
                )
        
        # Check for unique email globally (AbstractUser's default)
        email = data.get('email')
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "A user with that email already exists."}
            )

        return data
    
    def create(self, validated_data):
        print("🟡 STARTING MEMBER CREATION PROCESS")
        
        # Extract user data
        first_name = validated_data.pop('first_name')
        surname = validated_data.pop('surname')
        phone = validated_data.pop('phone')
        address = validated_data.pop('address', '')
        group = validated_data.pop('group', None)
        passport_photo = validated_data.pop('passport', None)
        card_number = validated_data.pop('card_number', None)
        email = validated_data.pop('email')
        
        # Extract next of kin data (handle missing data)
        kin_first_name = validated_data.pop('kinName', '')
        kin_surname = validated_data.pop('kinSurname', '')
        kin_phone = validated_data.pop('kinPhone', '')
        kin_address = validated_data.pop('kinAddress', '')
        
        # paymentConfirmed is ignored - payment is always bypassed
        validated_data.pop('paymentConfirmed', True)
        
        username = phone
        password = surname
        
        user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=surname,
                phone=phone,
                address=address,
                password=make_password(password),
                role='member'
            )
        print(f"✅ Created user: {user.username} with role: {user.role}")
       
        # Create member with payment bypassed
        member = Member.objects.create(
                user=user,
                group=group,
                passport_photo=passport_photo,
                phone=phone,
                address=address,
                membership_fee_paid=True,
                status='active',
                card_number=card_number
            )
            
        print(f"✅ SUCCESS: Created member: {member.card_number} in group: {group.name}")
       
        # Create next of kin only if data is provided
        if kin_first_name and kin_surname:
            try:
                NextOfKin.objects.create(
                    member=member,
                    first_name=kin_first_name,
                    last_name=kin_surname,
                    phone=kin_phone,
                    address=kin_address
                )
                print("✅ Created next of kin")
            except Exception as e:
                print(f"⚠️ Error creating next of kin: {e}")
                # Continue even if next of kin fails
        
        # Automatically create a bypassed payment record for registration fee
        try:
            Payment.objects.create(
                member=member,
                amount=20300.00,
                payment_method='bypassed',
                is_successful=True
            )
            print("✅ Created payment record")
        except Exception as e:
            print(f"⚠️ Error creating payment record: {e}")
            # Continue even if payment record fails
        
        print("🎉 MEMBER REGISTRATION COMPLETED SUCCESSFULLY")
        return member

class AdminMemberCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True,)
    card_number = serializers.CharField(write_only=True,)
    first_name = serializers.CharField(write_only=True)
    surname = serializers.CharField(write_only=True)
    phone = serializers.CharField()
    address = serializers.CharField(required=False, allow_blank=True)
    passport = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    kinName = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinSurname = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinPhone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    kinAddress = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Member
        fields = (
            'email', 'card_number','first_name', 'surname', 'phone', 'address', 'passport',
            'kinName', 'kinSurname', 'kinPhone', 'kinAddress'
        )
    
    def validate(self, data):
        group_admin = self.context.get('group_admin')
        if not group_admin or not group_admin.managed_group:
             raise serializers.ValidationError("Admin context or managed group is missing.")
             
        group = group_admin.managed_group
        card_number = data.get('card_number')

        if Member.objects.filter(group=group, card_number=card_number).exists():
            raise serializers.ValidationError(
                {"card_number": f"Card number '{card_number}' is already taken in your group '{group.name}'."}
            )
            
        # Check for unique email globally (AbstractUser's default)
        email = data.get('email')
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "A user with that email already exists."}
            )

        return data

    @db_transaction.atomic
    def create(self, validated_data):
        group_admin = self.context.get('group_admin')
        if not group_admin:
            raise serializers.ValidationError("Group admin context is required.")
        group = group_admin.managed_group

        first_name = validated_data.pop('first_name')
        surname = validated_data.pop('surname')
        phone = validated_data.pop('phone')
        address = validated_data.pop('address', '')
        passport = validated_data.pop('passport', None)
        card_number = validated_data.pop('card_number', None)
        email = validated_data.pop('email')

        kin_first_name = validated_data.pop('kinName', '')
        kin_surname = validated_data.pop('kinSurname', '')
        kin_phone = validated_data.pop('kinPhone', '')
        kin_address = validated_data.pop('kinAddress', '')

        username = phone
        password = surname  # Use surname as password

        # Create User with hashed password
        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=surname,
            phone=phone,
            address=address,
            password=make_password(password),
            role='member'
        )

        member = Member.objects.create(
            user=user,
            group=group,
            passport_photo=passport,
            phone=phone,
            address=address,
            membership_fee_paid=True,
            status='active',
            card_number=card_number
        )

        if kin_first_name and kin_surname:
            NextOfKin.objects.create(
                member=member,
                first_name=kin_first_name,
                last_name=kin_surname,
                phone=kin_phone,
                address=kin_address
            )

        # Create bypassed payment for registration fee
        Payment.objects.create(
            member=member,
            amount=20300.00,
            payment_method='bypassed',
            is_successful=True
        )

        return member

class MemberLoginSerializer(serializers.Serializer):
    phone = serializers.CharField(required=True)
    surname = serializers.CharField(required=True)
    
    def validate(self, attrs):
        phone = attrs.get('phone')
        surname = attrs.get('surname')
        
        if not phone or not surname:
            raise serializers.ValidationError("Both phone and surname are required.")
        
        try:
            print(f"Looking for member with phone: {phone} and surname: {surname}")
            # Find member by phone and surname (case-insensitive)
            member = Member.objects.select_related('user').get(phone=phone, user__last_name__iexact=surname)
            print(f"Member found: {member.card_number}")
            
            if not member.user.is_active:
                raise serializers.ValidationError("Account is disabled. Please contact administrator.")
                
            attrs['member'] = member
            return attrs
            
        except Member.DoesNotExist:
            print(f"Member not found with phone: {phone} and surname: {surname}")
            raise serializers.ValidationError("Invalid phone number or surname.")
        except Exception as e:
            print(f"Error in login serializer: {e}")
            raise serializers.ValidationError(f"Login error: {str(e)}")

class ContributionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionPlan
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.get_full_name', read_only=True)
    card_number = serializers.CharField(source='member.card_number', read_only=True)
    
    class Meta:
        model = Transaction
        fields = ('id', 'member', 'card_number', 'transaction_type', 'amount', 'description', 'status', 'transaction_date', 'reference', 'member_name')

class MemberContributionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_amount = serializers.DecimalField(source='plan.amount', read_only=True, max_digits=10, decimal_places=2)
    
    class Meta:
        model = MemberContribution
        fields = '__all__'

class ContributionPaymentSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(required=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    week_number = serializers.IntegerField(required=True)
    month = serializers.IntegerField(required=True)
    year = serializers.IntegerField(required=True)

class GroupAdminCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    phone = serializers.CharField(required=False)
    group_id = serializers.IntegerField(required=True)
    
    class Meta:
        model = User
        fields = ('username', 'password', 'first_name', 'last_name', 'email', 'phone', 'group_id')
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value
    
    def validate_group_id(self, value):
        try:
            group = CooperativeGroup.objects.get(id=value)
            return group
        except CooperativeGroup.DoesNotExist:
            raise serializers.ValidationError("Group does not exist.")
    
    def create(self, validated_data):
        group = validated_data.pop('group_id')
        password = validated_data.pop('password')
        
        user = User.objects.create(
            **validated_data,
            role='group_admin',
            managed_group=group,
            is_staff=True
        )
        
        user.set_password(password)
        user.save()
        
        return user

class GroupAdminSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='managed_group.name', read_only=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name', 'email', 
            'phone', 'role', 'managed_group', 'group_name', 'date_joined'
        )

# UPDATED: Dashboard Serializers with enhanced financial data
class DashboardMemberInfoSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', read_only=True)
    group = serializers.CharField(source='group.name', read_only=True)
    has_photo = serializers.SerializerMethodField()
    
    class Meta:
        model = Member
        fields = ['name', 'card_number', 'group', 'status', 'passport_photo', 'has_photo', 'phone', 'group_id']
    
    def get_has_photo(self, obj):
        return bool(obj.passport_photo)

class FinancialSummarySerializer(serializers.Serializer):
    total_savings = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    outstanding_loans = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    fixed_deposits = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    investment_loans = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_contributions = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    weekly_contributions = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_contributions = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    weekly_savings = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_savings = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)

class ActiveObligationSerializer(serializers.Serializer):
    type = serializers.CharField()
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding = serializers.DecimalField(max_digits=10, decimal_places=2)
    progress = serializers.FloatField()

class DashboardSerializer(serializers.Serializer):
    member_info = DashboardMemberInfoSerializer()
    financial_summary = FinancialSummarySerializer()
    active_obligations = serializers.DictField(child=serializers.ListField(child=ActiveObligationSerializer()))

# UPDATED: Payment History Serializer with enhanced fields
class PaymentHistorySerializer(serializers.ModelSerializer):
    type = serializers.CharField(source='payment_type', read_only=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    status = serializers.CharField(read_only=True)
    payment_type = serializers.CharField(read_only=True)
    reference = serializers.CharField(source='reference_number', read_only=True)
    date = serializers.DateTimeField(source='created_at', read_only=True)
    method = serializers.SerializerMethodField()
    bank_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = ManualPayment
        fields = ['id', 'type', 'amount', 'status', 'payment_type', 'reference', 'date', 'method', 'bank_name']
    
    def get_method(self, obj):
        return 'manual'

# NEW: Combined Payment History for member dashboard
class CombinedPaymentHistorySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    date = serializers.DateTimeField()
    payment_type = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    status = serializers.CharField()
    reference_number = serializers.CharField(allow_null=True)
    bank_name = serializers.CharField(allow_null=True)
    transaction_reference = serializers.CharField(allow_null=True)
    is_successful = serializers.BooleanField(allow_null=True)
    payment_source = serializers.CharField(allow_null=True)

# NEW: Group Account Serializer
class GroupAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = CooperativeGroup
        fields = ['id', 'name', 'bank_name', 'account_number', 'account_name']

# NEW: Admin Manual Payment Create Serializer
class AdminManualPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualPayment
        fields = ['amount', 'payment_type', 'bank_name', 'transaction_reference', 'transfer_date', 'admin_notes']
    
    def validate_amount(self, value):
        if value < 1100:
            raise serializers.ValidationError("Minimum payment amount is ₦1100")
        return value
    

# Add these serializers to your serializers.py

class SavingsSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    
    class Meta:
        model = Savings
        fields = ['id', 'member', 'member_name', 'balance', 'last_updated']

class FixedDepositSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    
    class Meta:
        model = FixedDeposit
        fields = ['id', 'member', 'member_name', 'amount', 'interest_rate', 'duration_months', 
                 'start_date', 'maturity_date', 'is_active', 'created_at']

class InvestmentLoanSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_card_number = serializers.CharField(source='member.card_number', read_only=True)
    
    class Meta:
        model = InvestmentLoan
        fields = ['id', 'member', 'member_name', 'member_card_number', 'group', 'amount', 
                 'outstanding_balance', 'interest_rate', 'purpose', 'status', 'created_at']

class OutstandingBalanceSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    
    class Meta:
        model = OutstandingBalance
        fields = ['id', 'member', 'member_name', 'total_amount', 'last_updated']