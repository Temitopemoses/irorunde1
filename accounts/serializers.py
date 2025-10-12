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
    user = UserSerializer()
    next_of_kin = NextOfKinSerializer(read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    class Meta:
        model = Member
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class MemberRegistrationSerializer(serializers.ModelSerializer):
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
        fields = ('first_name', 'surname', 'phone', 'address', 'group', 
                 'passport', 'kinName', 'kinSurname', 'kinPhone', 'kinAddress', 'paymentConfirmed')
    
    def validate_group(self, value):
        """
        Handle group validation - create group if it doesn't exist
        """
        if value:
            try:
                # Try to get existing group
                group = CooperativeGroup.objects.get(name=value)
                return group  # ← FIXED: Return the instance!
            except CooperativeGroup.DoesNotExist:
                # Create new group if it doesn't exist
                print(f"Group '{value}' not found. Creating new group...")
                group = CooperativeGroup.objects.create(name=value)
                print(f"Created new group: {group.name}")
                return group
        return None
    
    def validate(self, data):
        """
        Custom validation to handle different scenarios
        """
        print("Validation data received:", data)
        
        # Check if required fields are present
        if not data.get('first_name'):
            raise serializers.ValidationError({"first_name": "First name is required"})
        
        if not data.get('surname'):
            raise serializers.ValidationError({"surname": "Surname is required"})
        
        if not data.get('phone'):
            raise serializers.ValidationError({"phone": "Phone number is required"})
        
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
        
        # Extract next of kin data (handle missing data)
        kin_first_name = validated_data.pop('kinName', '')
        kin_surname = validated_data.pop('kinSurname', '')
        kin_phone = validated_data.pop('kinPhone', '')
        kin_address = validated_data.pop('kinAddress', '')
        
        # paymentConfirmed is ignored - payment is always bypassed
        validated_data.pop('paymentConfirmed', True)
        
        # Create user with unique username
        base_username = f"{first_name.lower()}.{surname.lower()}"
        username = base_username
        counter = 1
        
        # Ensure username is unique
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        email = f"{first_name.lower()}@irorunde.com"
        
        # Generate random password
        random_password = get_random_string(12)
        
        try:
            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=surname,
                phone=phone,
                address=address,
                password=make_password(random_password),
                role='member'  # ← CRITICAL FIX: Set user role to 'member'
            )
            print(f"✅ Created user: {user.username} with role: {user.role}")
        except Exception as e:
            print(f"❌ Error creating user: {e}")
            raise serializers.ValidationError(f"Error creating user: {e}")
        
        # CHECK: Make sure member doesn't already exist (safety check)
        if Member.objects.filter(user=user).exists():
            print(f"❌ MEMBER ALREADY EXISTS FOR USER: {user.username}")
            existing_member = Member.objects.get(user=user)
            print(f"Existing member ID: {existing_member.id}")
            # Don't delete - just return the existing member
            return existing_member
        
        # Create member with payment bypassed
        try:
            member = Member.objects.create(
                user=user,
                group=group,
                passport_photo=passport_photo,
                phone=phone,
                address=address,
                membership_fee_paid=True,
                status='active'
            )
            
            # Generate membership number
            member.membership_number = f"IR{member.id:06d}"
            member.save()
            print(f"✅ SUCCESS: Created member: {member.membership_number} in group: {group}")
        except Exception as e:
            print(f"❌ Error creating member: {e}")
            # Delete user if member creation fails
            user.delete()
            raise serializers.ValidationError(f"Error creating member: {e}")
        
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
    first_name = serializers.CharField(write_only=True)
    surname = serializers.CharField(write_only=True)
    phone = serializers.CharField()
    address = serializers.CharField(required=False, allow_blank=True)
    group = serializers.CharField(required=False, allow_blank=True)
    passport = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Member
        fields = ('first_name', 'surname', 'phone', 'address', 'group', 'passport')
    
def validate_group(self, value):
    """
    Handle group validation - accept both group names and IDs
    """
    if not value:
        return None
    
    print(f"🟡 Validating group: {value}, type: {type(value)}")
    
    try:
        # If value is a CooperativeGroup instance, return it directly
        if isinstance(value, CooperativeGroup):
            print(f"✅ Group is already an instance: {value.name}")
            return value
        
        # If value is numeric, treat as ID
        if value.isdigit():
            group = CooperativeGroup.objects.get(id=int(value))
            print(f"✅ Found group by ID: {group.name}")
            return group
        
        # Otherwise treat as name
        group = CooperativeGroup.objects.get(name=value)
        print(f"✅ Found group by name: {group.name}")
        return group
        
    except CooperativeGroup.DoesNotExist:
        # Create new group if it doesn't exist
        print(f"🟡 Group '{value}' not found. Creating new group...")
        group = CooperativeGroup.objects.create(name=str(value))
        print(f"✅ Created new group: {group.name} (ID: {group.id})")
        return group
    except Exception as e:
        print(f"❌ Error validating group: {e}")
        raise serializers.ValidationError(f"Invalid group: {str(e)}")
    
    def create(self, validated_data):
        first_name = validated_data.pop('first_name')
        surname = validated_data.pop('surname')
        phone = validated_data.pop('phone')
        address = validated_data.pop('address', '')
        group = validated_data.pop('group', None)
        passport_photo = validated_data.pop('passport', None)
        
        # Create user with unique username
        base_username = f"{first_name.lower()}.{surname.lower()}"
        username = base_username
        counter = 1
        
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        email = f"{first_name.lower()}@irorunde.com"
        
        # Generate random password
        random_password = get_random_string(12)
        
        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=surname,
            phone=phone,
            address=address,
            password=make_password(random_password),
            role='member'  # ← ADDED: Set role to member
        )
        
        # Create member with payment bypassed
        member = Member.objects.create(
            user=user,
            group=group,
            passport_photo=passport_photo,
            phone=phone,
            address=address,
            membership_fee_paid=True,
            status='active'
        )
        
        # Generate membership number
        member.membership_number = f"IR{member.id:06d}"
        member.save()
        
        # Create bypassed payment record
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
            print(f"Member found: {member.membership_number}")
            
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
    membership_number = serializers.CharField(source='member.membership_number', read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'

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