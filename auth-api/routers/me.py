"""GET /me：需 access_token，返回 user + subscription"""
from fastapi import APIRouter, Depends

from deps import get_current_user
from models import Subscription, User
from schemas import MeResponse, SubscriptionOut, UserOut

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    sub = user.subscription
    sub_out = SubscriptionOut(
        plan=sub.plan if sub else "free",
        status=sub.status if sub else "active",
        current_period_end=sub.current_period_end if sub else None,
        features=(sub.features_json or []) if sub else [],
    )
    return MeResponse(
        user=UserOut(
            id=user.id,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            status=user.status,
        ),
        subscription=sub_out,
    )
