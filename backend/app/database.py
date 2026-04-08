import os
from dotenv import load_dotenv
from supabase import create_client, Client

# .env 파일에서 환경 변수 불러오기
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# Supabase 클라이언트 생성
supabase: Client = create_client(url, key)