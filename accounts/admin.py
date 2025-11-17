from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import User, Member, NextOfKin, CooperativeGroup, Payment, ContributionPlan, Transaction, MemberContribution

# ==================== CUSTOM ACTIONS ====================
def make_superadmin(modeladmin, request, queryset):
    queryset.update(role='superadmin')
make_superadmin.short_description = "Mark selected users as Super Admin"

def make_group_admin(modeladmin, request, queryset):
    queryset.update(role='group_admin')
make_group_admin.short_description = "Mark selected users as Group Admin"

def make_member_role(modeladmin, request, queryset):
    queryset.update(role='member')
make_member_role.short_description = "Mark selected users as Member"

def activate_members(modeladmin, request, queryset):
    queryset.update(status='active')
activate_members.short_description = "Activate selected members"

def deactivate_members(modeladmin, request, queryset):
    queryset.update(status='inactive')
deactivate_members.short_description = "Deactivate selected members"

def mark_payment_paid(modeladmin, request, queryset):
    queryset.update(membership_fee_paid=True)
mark_payment_paid.short_description = "Mark selected members as paid"

def mark_payment_successful(modeladmin, request, queryset):
    queryset.update(is_successful=True)
mark_payment_successful.short_description = "Mark selected payments as successful"

# ==================== SIMPLIFIED RESTRICTION MIXIN ====================
class GroupAdminRestrictionMixin:
    """Mixin to restrict group admins to their managed group only"""
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_authenticated and request.user.role == 'group_admin':
            if hasattr(request.user, 'managed_group') and request.user.managed_group:
                # Handle different model relationships
                if hasattr(qs.model, 'group'):
                    return qs.filter(group=request.user.managed_group)
                elif hasattr(qs.model, 'member'):
                    return qs.filter(member__group=request.user.managed_group)
        return qs

# ==================== USER ADMIN ====================
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'get_managed_group', 'phone', 'is_staff_display', 'created_at')
    list_filter = ('role', 'managed_group', 'created_at')  # REMOVED: 'is_staff' since it's a property
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    readonly_fields = ('created_at',)
    actions = [make_superadmin, make_group_admin, make_member_role]
    
    fieldsets = UserAdmin.fieldsets + (
        ('Cooperative Information', {
            'fields': ('role', 'managed_group', 'phone', 'address', 'created_at')
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'email', 'first_name', 'last_name'),
        }),
        ('Cooperative Information', {
            'fields': ('role', 'managed_group', 'phone', 'address')
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'group_admin':
            return qs.filter(id=request.user.id)
        return qs
    
    def get_managed_group(self, obj):
        return obj.managed_group.name if obj.managed_group else "None"
    get_managed_group.short_description = 'Managed Group'
    
    def is_staff_display(self, obj):
        return obj.is_staff
    is_staff_display.short_description = 'Staff Access'
    is_staff_display.boolean = True

# ==================== MEMBER ADMIN ====================
@admin.register(Member)
class MemberAdmin(GroupAdminRestrictionMixin, admin.ModelAdmin):
    list_display = (
        'card_number', 
        'get_user_full_name', 
        'get_group_name',
        'phone', 
        'status', 
        'membership_fee_paid', 
        'registration_date',
        'passport_photo_preview'
    )
    list_filter = ('status', 'group', 'membership_fee_paid', 'registration_date')
    search_fields = (
        'user__first_name', 
        'user__last_name', 
        'card_number', 
        'phone',
        'user__email',
        'group__name'
    )
    readonly_fields = ('registration_date', 'passport_photo_preview', 'card_number')
    list_select_related = ('user', 'group')
    list_per_page = 20
    actions = [activate_members, deactivate_members, mark_payment_paid]
    
    fieldsets = (
        ('Basic Information', {
            'fields': (
                'user', 
                'card_number', 
                'group',
                'status',
                'registration_date'
            )
        }),
        ('Contact Information', {
            'fields': ('phone', 'address')
        }),
        ('Membership Details', {
            'fields': ('membership_fee_paid',)
        }),
        ('Passport Photo', {
            'fields': ('passport_photo', 'passport_photo_preview')
        }),
    )
    
    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"
    get_user_full_name.short_description = 'Member Name'
    get_user_full_name.admin_order_field = 'user__first_name'
    
    def get_group_name(self, obj):
        return obj.group.name if obj.group else "No Group"
    get_group_name.short_description = 'Group'
    get_group_name.admin_order_field = 'group__name'
    
    def passport_photo_preview(self, obj):
        if obj.passport_photo:
            return format_html(
                '<img src="{}" width="50" height="50" style="border-radius: 50%; object-fit: cover;" />',
                obj.passport_photo.url
            )
        return "No Photo"
    passport_photo_preview.short_description = 'Passport Preview'
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "user":
            kwargs["queryset"] = User.objects.filter(role='member')
        elif db_field.name == "group" and request.user.role == 'group_admin':
            if hasattr(request.user, 'managed_group') and request.user.managed_group:
                kwargs["queryset"] = CooperativeGroup.objects.filter(id=request.user.managed_group.id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

# ==================== COOPERATIVE GROUP ADMIN ====================
@admin.register(CooperativeGroup)
class CooperativeGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_admin_count', 'flutterwave_subaccount_id', 'get_member_count', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'get_admin_count', 'get_member_count')
    list_per_page = 20
    list_editable = ('flutterwave_subaccount_id', 'is_active')
    
    fieldsets = (
        ('Group Information', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Statistics', {
            'fields': ('get_admin_count', 'get_member_count', 'created_at')
        }),
    )
    
    def get_admin_count(self, obj):
        return obj.group_admins.count()
    get_admin_count.short_description = 'Group Admins'
    
    def get_member_count(self, obj):
        return obj.member_set.count()
    get_member_count.short_description = 'Total Members'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == 'group_admin':
            if hasattr(request.user, 'managed_group') and request.user.managed_group:
                return qs.filter(id=request.user.managed_group.id)
            else:
                return qs.none()
        return qs

# ==================== PAYMENT ADMIN ====================
@admin.register(Payment)
class PaymentAdmin(GroupAdminRestrictionMixin, admin.ModelAdmin):
    list_display = (
        'id',
        'get_member_name',
        'get_member_group',
        'amount',
        'payment_method',
        'is_successful',
        'created_at',
        'paid_at'
    )
    list_filter = ('is_successful', 'payment_method', 'created_at', 'paid_at')
    search_fields = (
        'member__user__first_name',
        'member__user__last_name',
        'member__card_number',
        'paystack_reference',
        'member__group__name'
    )
    readonly_fields = ('created_at', 'paid_at')
    list_select_related = ('member__user', 'member__group')
    list_per_page = 20
    actions = [mark_payment_successful]
    
    fieldsets = (
        ('Payment Information', {
            'fields': (
                'member',
                'amount',
                'payment_method',
                'is_successful'
            )
        }),
        ('Payment Details', {
            'fields': (
                'paystack_reference',
                'created_at',
                'paid_at'
            )
        }),
    )
    
    def get_member_name(self, obj):
        return f"{obj.member.user.first_name} {obj.member.user.last_name}"
    get_member_name.short_description = 'Member'
    get_member_name.admin_order_field = 'member__user__first_name'
    
    def get_member_group(self, obj):
        return obj.member.group.name if obj.member.group else "No Group"
    get_member_group.short_description = 'Member Group'
    get_member_group.admin_order_field = 'member__group__name'

# ==================== NEXT OF KIN ADMIN ====================
@admin.register(NextOfKin)
class NextOfKinAdmin(GroupAdminRestrictionMixin, admin.ModelAdmin):
    list_display = ('get_full_name', 'phone', 'get_member_name', 'get_member_group', 'relationship')
    list_filter = ('relationship',)
    search_fields = ('first_name', 'last_name', 'phone', 'member__user__first_name', 'member__user__last_name', 'member__group__name')
    list_select_related = ('member__user', 'member__group')
    list_per_page = 20
    
    fieldsets = (
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'relationship')
        }),
        ('Contact Information', {
            'fields': ('phone', 'address')
        }),
        ('Member Association', {
            'fields': ('member',)
        }),
    )
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
    get_full_name.short_description = 'Next of Kin Name'
    
    def get_member_name(self, obj):
        return f"{obj.member.user.first_name} {obj.member.user.last_name}"
    get_member_name.short_description = 'Member'
    
    def get_member_group(self, obj):
        return obj.member.group.name if obj.member.group else "No Group"
    get_member_group.short_description = 'Member Group'

# ==================== SIMPLIFIED OTHER MODELS ====================
@admin.register(ContributionPlan)
class ContributionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'amount', 'frequency', 'is_active')
    list_filter = ('frequency', 'is_active')
    search_fields = ('name', 'description')

@admin.register(Transaction)
class TransactionAdmin(GroupAdminRestrictionMixin, admin.ModelAdmin):
    list_display = ('reference', 'get_member_name', 'get_member_group', 'transaction_type', 'amount', 'status', 'transaction_date')
    list_filter = ('transaction_type', 'status', 'transaction_date')
    search_fields = ('reference', 'member__user__first_name', 'member__user__last_name', 'member__card_number', 'member__group__name')
    readonly_fields = ('transaction_date',)
    list_select_related = ('member__user', 'member__group')
    
    def get_member_name(self, obj):
        return f"{obj.member.user.first_name} {obj.member.user.last_name}"
    get_member_name.short_description = 'Member'
    
    def get_member_group(self, obj):
        return obj.member.group.name if obj.member.group else "No Group"
    get_member_group.short_description = 'Member Group'

@admin.register(MemberContribution)
class MemberContributionAdmin(GroupAdminRestrictionMixin, admin.ModelAdmin):
    list_display = ('get_member_name', 'get_member_group', 'plan', 'amount_paid', 'year', 'payment_date')
    list_filter = ('plan', 'year', 'payment_date')
    search_fields = ('member__user__first_name', 'member__user__last_name', 'member__card_number', 'member__group__name')
    list_select_related = ('member__user', 'member__group', 'plan')
    
    def get_member_name(self, obj):
        return f"{obj.member.user.first_name} {obj.member.user.last_name}"
    get_member_name.short_description = 'Member'
    
    def get_member_group(self, obj):
        return obj.member.group.name if obj.member.group else "No Group"
    get_member_group.short_description = 'Member Group'

# ==================== ADMIN SITE CONFIGURATION ====================
admin.site.site_header = "Irorunde Cooperative Society Administration"
admin.site.site_title = "Irorunde Admin Portal"
admin.site.index_title = "Super Administrator Dashboard"