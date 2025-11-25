from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

class CooperativeGroup(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Bank account details for manual payments
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=20, blank=True, null=True)
    account_name = models.CharField(max_length=100, blank=True, null=True)
    
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
        """Check if user has specific permission"""
        # Superadmins have all permissions
        if self.role == 'superadmin' or self.is_superuser:
            return True
        
        # Group admins have limited permissions for their group
        if self.role == 'group_admin':
            # Define allowed permissions for group admins
            allowed_permissions = [
                # Member permissions
                'accounts.view_member', 'accounts.change_member',
                # Next of Kin permissions  
                'accounts.view_nextofkin', 'accounts.change_nextofkin',
                # Payment permissions
                'accounts.view_payment', 'accounts.change_payment',
                # Transaction permissions
                'accounts.view_transaction', 'accounts.change_transaction',
                # Member Contribution permissions
                'accounts.view_membercontribution', 'accounts.change_membercontribution',
                # User permissions (limited to themselves and their group members)
                'accounts.view_user', 'accounts.change_user',
                # Cooperative Group permissions (limited to their managed group)
                'accounts.view_cooperativegroup', 'accounts.change_cooperativegroup',
                # Manual Payment permissions
                'accounts.view_manualpayment', 'accounts.change_manualpayment',
            ]
            
            # Check if permission is in allowed list
            if perm in allowed_permissions:
                return True
        
        return super().has_perm(perm, obj)
    
    def has_module_perms(self, app_label):
        """Check if user has permissions to view the app in admin"""
        # Superadmins can access all apps
        if self.role == 'superadmin' or self.is_superuser:
            return True
        
        # Group admins can only access accounts app
        if self.role == 'group_admin' and app_label == 'accounts':
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
    card_number = models.CharField(max_length=50)

    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17)
    address = models.TextField()
    registration_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    membership_fee_paid = models.BooleanField(default=True)    
     # Historical data fields (for members joining with existing balances)
    last_savings_date = models.DateTimeField(null=True, blank=True)
    pending_savings_penalty = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_savings_penalties_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    class Meta:
        ordering = ['-registration_date']
        verbose_name = "Member"
        verbose_name_plural = "Members"
        unique_together = ('group', 'card_number')
    
    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"
    
    def save(self, *args, **kwargs):
        is_new = self.pk is None  # Check if this is a new member
        super().save(*args, **kwargs)
        
        # Initialize balances for new members
        if is_new:
            self.initialize_balances()
    
    def initialize_balances(self):
        """Initialize all balance records for a new member"""
        try:
            Savings.objects.get_or_create(member=self, defaults={'balance': 0.00})
            OutstandingBalance.objects.get_or_create(member=self, defaults={'total_amount': 0.00})
            print(f"✅ Initialized balances for {self.full_name}")
        except Exception as e:
            print(f"⚠️ Error initializing balances: {str(e)}")
    
    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}"

# In models.py - Update ManualPayment model
class ManualPayment(models.Model):
    PAYMENT_TYPES = [
        ('registration', 'Registration'),
        ('savings', 'Savings'),
        ('outstanding_balance', 'Outstanding Balance'),
        ('investment_loan', 'Investment Loan'),
        ('fixed_deposit', 'Fixed Deposit'),
    ]
    
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True)
    group = models.ForeignKey(CooperativeGroup, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPES)
    bank_name = models.CharField(max_length=100, blank=True)
    transaction_reference = models.CharField(max_length=100, blank=True)
    transfer_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected')
    ], default='pending')
    reference_number = models.CharField(max_length=20, unique=True, blank=True, null="True")
    admin_notes = models.TextField(blank=True,default='')
    
    penalty_details = models.JSONField(default=dict, blank=True)
    applied_to_purpose = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    
    # Bank transfer details
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    transaction_reference = models.CharField(max_length=100, blank=True, null=True)
    transfer_date = models.DateField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Manual Payment"
        verbose_name_plural = "Manual Payments"
    
    def __str__(self):
        return f"Manual Payment #{self.id} - {self.member.full_name} - ₦{self.amount} - {self.status}"
    
    def save(self, *args, **kwargs):
        # Auto-generate reference number if not provided
        if not self.reference_number:
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            self.reference_number = f"MANUAL{timestamp}{self.member.card_number}"
        
        # Set confirmed_at timestamp when status changes to confirmed
        if self.status == 'confirmed' and not self.confirmed_at:
            self.confirmed_at = timezone.now()
        
        super().save(*args, **kwargs)

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
    # Simplified payment methods - only manual/bank transfer options
    PAYMENT_METHODS = (
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
        ('manual', 'Manual Confirmation'),
    )
    
    member = models.ForeignKey('Member', on_delete=models.CASCADE, related_name='payments')
    group = models.ForeignKey('CooperativeGroup', on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='bank_transfer')
    card_number_reference = models.CharField(max_length=10, blank=True, null=True)
    
    # Link to manual payment
    manual_payment = models.OneToOneField(
        ManualPayment, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='payment_record'
    )
    
    is_successful = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
    
    def __str__(self):
        return f"Payment #{self.id} - {self.member.full_name} - ₦{self.amount}"
    
    def save(self, *args, **kwargs):
        if not self.card_number_reference and self.member and self.member.card_number:
            self.card_number_reference = self.member.card_number
            
        super().save(*args, **kwargs)

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
        return f"{self.member.card_number} - Week {self.week_number} - ₦{self.amount_paid}"

# In models.py - Add Loan models
class Loan(models.Model):
    LOAN_TYPES = [
        ('regular', 'Regular Loan'),
        ('investment', 'Investment Loan'),
      
    ]
    
    LOAN_STATUS = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('defaulted', 'Defaulted'),
    ]
    
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='loans')
    group = models.ForeignKey(CooperativeGroup, on_delete=models.CASCADE)
    loan_type = models.CharField(max_length=20, choices=LOAN_TYPES, default='regular')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_granted = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    remaining_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    #for regular loans
    interest_weeks = models.IntegerField(default=0)
    last_interest_date = models.DateTimeField(null=True, blank=True)
    total_interest_added = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    pending_penalty = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_penalties_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    first_interest_applied = models.BooleanField(default=False)
    purpose = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('active', 'Active'), ('completed', 'Completed'), ('defaulted', 'Defaulted')], default='pending')
        # Calculation fields
   
    
    # Admin fields
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_loans')
    granted_at = models.DateTimeField(auto_now_add=True)
    admin_notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Loan"
        verbose_name_plural = "Loans"
    def __str__(self):
        return f"{self.member.full_name} - {self.loan_type} Loan - ₦{self.amount}"
    
    def calculate_first_interest(self):
        """Calculate first 2% interest based on amount granted (after 4 weeks)"""
        if self.loan_type != 'regular' or self.first_interest_applied:
            return 0
            
        interest_amount = self.amount_granted * Decimal('0.02')
        if interest_amount > 0:
            self.remaining_balance += interest_amount
            self.total_interest_added += interest_amount
            self.first_interest_applied = True
            
            LoanPayment.objects.create(
                loan=self,
                amount=interest_amount,
                payment_type='interest',
                week_number=4,
                description=f"First 2% interest on amount granted (₦{self.amount_granted})",
                balance_after=self.remaining_balance
            )
            return interest_amount
        return 0
    
    def calculate_subsequent_interest(self):
        """Calculate 2% interest based on current balance (every 4 weeks after first)"""
        if self.loan_type != 'regular' or not self.first_interest_applied:
            return 0
            
        interest_amount = self.remaining_balance * Decimal('0.02')
        if interest_amount > 0:
            self.remaining_balance += interest_amount
            self.total_interest_added += interest_amount
            
            LoanPayment.objects.create(
                loan=self,
                amount=interest_amount,
                payment_type='interest',
                week_number=self.interest_weeks,
                description=f"2% interest on current balance (₦{self.remaining_balance})",
                balance_after=self.remaining_balance
            )
            return interest_amount
        return 0
    
    def save(self, *args, **kwargs):
    # Only set amount_granted if it's not already set
        if self.amount_granted == 0:
            self.amount_granted = self.amount
    
    # Only set remaining_balance for new loans or if it's zero
        if self._state.adding or self.remaining_balance == 0:
            self.remaining_balance = self.amount_granted
    
        super().save(*args, **kwargs)
        
class LoanPayment(models.Model):
    PAYMENT_TYPES = [
        ('repayment', 'Loan Repayment'),
        ('interest', 'Weekly Interest'),
        ('penalty', 'Late Payment Penalty'),
    ]
    
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='payments')
    manual_payment = models.ForeignKey(ManualPayment, on_delete=models.CASCADE, null=True, blank=True, related_name='loan_payments')  # ADD THIS FIELD
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPES, default='repayment')
    week_number = models.IntegerField(default=0)
    is_pending = models.BooleanField(default=False)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    paid_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        if not self.balance_after:
            if self.payment_type == 'repayment':
                self.balance_after = self.loan.remaining_balance - self.amount
            elif self.payment_type in ['interest', 'penalty']:
                self.balance_after = self.loan.remaining_balance + self.amount
        super().save(*args, **kwargs)
    
    
    def __str__(self):
        return f"Payment for {self.loan} - ₦{self.amount} ({self.payment_type})"

class SavingsPenalty(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='savings_penalties')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    week_number = models.IntegerField()
    is_pending = models.BooleanField(default=True)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    paid_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Savings Penalty - {self.member.user.get_full_name()} - Week {self.week_number}"


class Savings(models.Model):
    """Track member savings balance"""
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='savings_account')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Savings"
        verbose_name_plural = "Savings"
    
    def __str__(self):
        return f"Savings - {self.member.full_name} - ₦{self.balance}"

class FixedDeposit(models.Model):
    """Track member fixed deposits"""
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='fixed_deposits')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    duration_months = models.IntegerField()
    start_date = models.DateField(default=timezone.now)
    maturity_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='active')  # Make sure this field exists
    collected_at = models.DateTimeField(null=True, blank=True)  

    
    class Meta:
        verbose_name = "Fixed Deposit"
        verbose_name_plural = "Fixed Deposits"
    
    def __str__(self):
        return f"Fixed Deposit - {self.member.full_name} - ₦{self.amount}"
    
    def save(self, *args, **kwargs):
        if not self.maturity_date:
            self.maturity_date = self.start_date + timedelta(days=self.duration_months * 30)
        super().save(*args, **kwargs)

class InvestmentLoan(models.Model):
    """Track investment loans (separate from regular loans)"""
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='investment_loans')
    group = models.ForeignKey(CooperativeGroup, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    outstanding_balance = models.DecimalField(max_digits=10, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    purpose = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Loan.LOAN_STATUS, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Investment Loan"
        verbose_name_plural = "Investment Loans"
    
    def __str__(self):
        return f"Investment Loan - {self.member.full_name} - ₦{self.amount}"

class OutstandingBalance(models.Model):
    """Track member's overall outstanding balance (loans + investment loans)"""
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='outstanding_balance')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Outstanding Balance"
        verbose_name_plural = "Outstanding Balances"
    
    def __str__(self):
        return f"Outstanding Balance - {self.member.full_name} - ₦{self.total_amount}"
    
    def update_balance(self):
        """Update total outstanding balance from all loans"""
        total_loans = sum(float(loan.remaining_balance) for loan in self.member.loans.filter(status='active'))
        total_investment_loans = sum(float(inv.outstanding_balance) for inv in self.member.investment_loans.filter(status='active'))
        self.total_amount = total_loans + total_investment_loans
        self.save()