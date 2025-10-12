from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.utils import timezone

class CooperativeGroup(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Cooperative Group"
        verbose_name_plural = "Cooperative Groups"

class User(AbstractUser):
    ROLE_CHOICES = (
        ('member', 'Member'),
        ('group_admin', 'Group Administrator'),
        ('superadmin', 'Super Administrator'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    phone = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Group field for group admins
    managed_group = models.ForeignKey(
        CooperativeGroup, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='group_admins'
    )
    
    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"
    
    def has_perm(self, perm, obj=None):
        """Group admins and superadmins have all permissions"""
        if self.role in ['group_admin', 'superadmin']:
            return True
        return super().has_perm(perm, obj)
    
    def has_module_perms(self, app_label):
        """Check if user has permissions to view the app"""
        if self.role in ['group_admin', 'superadmin'] and app_label == 'accounts':
            return True
        if self.role == 'superadmin':
            return True
        return super().has_module_perms(app_label)
    
    def is_super_admin(self):
        return self.role == 'superadmin' or self.is_superuser
    
    def is_group_admin(self):
        return self.role == 'group_admin'
    
    def is_member_user(self):
        return self.role == 'member'

class Member(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    )
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='member_profile')
    group = models.ForeignKey(CooperativeGroup, on_delete=models.SET_NULL, null=True, blank=True)
    passport_photo = models.ImageField(upload_to='passports/', null=True, blank=True)
    
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17)
    address = models.TextField()
    registration_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    membership_fee_paid = models.BooleanField(default=True)
    membership_number = models.CharField(max_length=20, unique=True, blank=True, null=True)
    
    class Meta:
        ordering = ['-registration_date']
        verbose_name = "Member"
        verbose_name_plural = "Members"
    
    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"
    
    def save(self, *args, **kwargs):
        if not self.membership_number:
            # Generate membership number
            year = timezone.now().year
            last_member = Member.objects.filter(
                membership_number__startswith=f'MEM{year}'
            ).order_by('membership_number').last()
            
            if last_member:
                last_number = int(last_member.membership_number[7:])
                new_number = last_number + 1
            else:
                new_number = 1
                
            self.membership_number = f"MEM{year}{new_number:04d}"
        
        super().save(*args, **kwargs)
    
    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}"

class NextOfKin(models.Model):
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='next_of_kin')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17)
    address = models.TextField()
    relationship = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

class Payment(models.Model):
    PAYMENT_METHODS = (
        ('paystack', 'Paystack'),
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
        ('bypassed', 'Bypassed'),
    )
    
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=20300.00)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='bypassed')
    paystack_reference = models.CharField(max_length=100, blank=True, null=True)
    is_successful = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
    
    def __str__(self):
        return f"Payment #{self.id} - {self.member.full_name} - ₦{self.amount}"
    
    @property
    def payment_status(self):
        return "Successful" if self.is_successful else "Failed"

class ContributionPlan(models.Model):
    PLAN_CHOICES = (
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    )
    
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=PLAN_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} - ₦{self.amount} ({self.frequency})"
    
    class Meta:
        verbose_name = "Contribution Plan"
        verbose_name_plural = "Contribution Plans"

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('contribution', 'Contribution'),
        ('withdrawal', 'Withdrawal'),
        ('loan', 'Loan'),
        ('savings', 'Savings'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_date = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=100, unique=True, blank=True)
    
    class Meta:
        ordering = ['-transaction_date']
        verbose_name = "Transaction"
        verbose_name_plural = "Transactions"
    
    def __str__(self):
        return f"{self.reference} - {self.member.full_name} - {self.get_transaction_type_display()}"
    
    def save(self, *args, **kwargs):
        if not self.reference:
            prefix = {
                'contribution': 'CONT',
                'withdrawal': 'WITH',
                'loan': 'LOAN', 
                'savings': 'SAVE'
            }.get(self.transaction_type, 'TRX')
            
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            self.reference = f"{prefix}{timestamp}"
        
        super().save(*args, **kwargs)

class MemberContribution(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='contributions')
    plan = models.ForeignKey(ContributionPlan, on_delete=models.CASCADE)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    week_number = models.IntegerField()
    month = models.IntegerField()
    year = models.IntegerField()
    payment_date = models.DateTimeField(auto_now_add=True)
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ['member', 'week_number', 'year', 'plan']
        verbose_name = "Member Contribution"
        verbose_name_plural = "Member Contributions"
    
    def __str__(self):
        return f"{self.member.membership_number} - Week {self.week_number} - ₦{self.amount_paid}"