from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Member

# @receiver(post_save, sender=User)
# def create_member_profile(sender, instance, created, **kwargs):
#     if created and instance.role == 'member':
#         # SAFETY CHECK: Only create if member doesn't exist
#         if not Member.objects.filter(user=instance).exists():
#             Member.objects.create(
#                 user=instance,
#                 phone=instance.phone or "Not provided",
#                 address=instance.address or "Not provided"
#             )
#             print(f"✅ Auto-created Member profile for {instance.username}")

@receiver(post_save, sender=User)
def handle_role_change(sender, instance, **kwargs):
    """
    Handle when user role changes between member/non-member
    """
    has_member_profile = hasattr(instance, 'member_profile')
    
    if instance.role == 'member' and not has_member_profile:
        # User changed to member role - create profile
        Member.objects.create(
            user=instance,
            phone=instance.phone or "Not provided",
            address=instance.address or "Not provided"
        )
    elif instance.role != 'member' and has_member_profile:
        # User is no longer member - delete profile
        instance.member_profile.delete()