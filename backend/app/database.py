from supabase import Client, create_client

from .core.config import settings

_db_key = (settings.SUPABASE_SERVICE_KEY or "").strip() or settings.SUPABASE_KEY
supabase: Client = create_client(settings.SUPABASE_URL, _db_key)
