from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum

from accounts.models import MemberProfile, User
from accounts.serializers import MemberSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """Return group-based summary for admin or all for superadmin."""
    user = request.user

    if user.role == 'superadmin':
        total_members = MemberProfile.objects.count()
        total_amount = MemberProfile.objects.aggregate(Sum('monthly_payment'))['monthly_payment__sum'] or 0
        return Response({
            "role": "superadmin",
            "total_members": total_members,
            "total_amount": total_amount,
            "message": "Superadmin overview of all groups"
        })

    elif user.role == 'admin':
        # Filter members belonging to admin’s group
        members = MemberProfile.objects.filter(group=user.group)
        total_members = members.count()
        total_amount = members.aggregate(Sum('monthly_payment'))['monthly_payment__sum'] or 0
        return Response({
            "role": "admin",
            "group": user.group,
            "total_members": total_members,
            "total_amount": total_amount,
            "members": [
                {
                    "name": f"{m.first_name} {m.surname}",
                    "phone": m.phone,
                    "payment_confirmed": m.payment_confirmed,
                } for m in members
            ]
        })

    return Response({"detail": "Access Denied"}, status=403)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_member(request):
    """Allow admins or superadmins to create members."""
    user = request.user
    if user.role not in ['admin', 'superadmin']:
        return Response({"detail": "Permission denied"}, status=403)

    data = request.data.copy()
    if user.role == 'admin':
        data['group'] = user.group  # force member to admin’s group

    serializer = MemberSerializer(data=data)
    if serializer.is_valid():
        member = serializer.save()
        return Response({
            "message": "Member created successfully",
            "member": MemberSerializer(member).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
