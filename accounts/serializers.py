from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from django.utils.crypto import get_random_string
from .models import User, Member, NextOfKin, Payment, CooperativeGroup
from .models import ContributionPlan, Transaction, MemberContribution
from django.db import transaction as db_transaction

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'address')
        read_only_fields = ('id', 'role')

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CooperativeGroup  # ← FIXED: Added model reference
        fields = '__all__'

class NextOfKinSerializer(serializers.ModelSerializer):
    class Meta:
        model = NextOfKin
        fields = '__all__'

class MemberSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    
    # 2. RETAIN OTHER FIELDS
    next_of_kin = NextOfKinSerializer(read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    # 3. CARD NUMBER (Keep this writable if admins are inputting it)
    card_number = serializers.CharField(max_length=10, required=False)
    
    class Meta:
        model = Member
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

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
                role='member'  # ← CRITICAL FIX: Set user role to 'member'
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
        
        # Automatically create a bypassed payment record
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
            group = CooperativeGroup.objects.get(id=value)  # ← FIXED: Changed Group to CooperativeGroup
            return group
        except CooperativeGroup.DoesNotExist:  # ← FIXED: Changed Group to CooperativeGroup
            raise serializers.ValidationError("Group does not exist.")
    
    def create(self, validated_data):
        group = validated_data.pop('group_id')
        password = validated_data.pop('password')
        
        user = User.objects.create(
            **validated_data,
            role='group_admin',  # ← FIXED: Changed 'admin' to 'group_admin' to match your roles
            managed_group=group,
            is_staff=True  # Give admin access to Django admin if needed
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