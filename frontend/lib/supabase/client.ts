import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// 브라우저 환경에서 단일 Supabase 인스턴스를 사용하도록 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
