import asyncio
import os
import sys
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.database import supabase
from app.routers.quiz import _run_quiz_generation

async def test_quiz_generation():
    course_id = "e9d119d3-a2e4-404d-80cd-94fcfb0fc16f"
    # Use the script we just uploaded in the previous test
    script_res = supabase.table("scripts").select("id, schedule_id").eq("course_id", course_id).order("uploaded_at", desc=True).limit(1).execute()
    
    if not script_res.data:
        print("No script found. Please run script analysis test first.")
        return

    script_id = script_res.data[0]["id"]
    # We need a schedule_id. Let's find one for this course.
    sched_res = supabase.table("course_schedules").select("id").eq("course_id", course_id).limit(1).execute()
    if not sched_res.data:
        print("No schedule found for this course.")
        return
    
    schedule_id = sched_res.data[0]["id"]
    
    print(f"--- [Quiz Test] Generating Quiz for Schedule: {schedule_id} ---")
    
    # Create quiz record
    quiz_res = supabase.table("quizzes").insert({
        "course_id": course_id,
        "schedule_id": schedule_id,
        "status": "generating",
        "difficulty_level": "MIXED",
        "anonymous_enabled": True
    }).execute()
    
    quiz_id = quiz_res.data[0]["id"]
    print(f"Quiz record created: {quiz_id}")
    
    print("AI Quiz Generation in progress (Gemini)...")
    try:
        _run_quiz_generation(
            quiz_id=quiz_id,
            course_id=course_id,
            schedule_id=schedule_id,
            question_count=3,
            question_types=["MULTIPLE_CHOICE", "TRUE_FALSE"],
            difficulty_level="MIXED"
        )
        
        # Check if questions were created
        questions_res = supabase.table("quiz_questions").select("*").eq("quiz_id", quiz_id).execute()
        if questions_res.data:
            print(f"\n✅ Quiz Generation COMPLETED! Created {len(questions_res.data)} questions.")
            for i, q in enumerate(questions_res.data):
                print(f"Q{i+1}: {q['content']}")
        else:
            # Check quiz status
            quiz_status = supabase.table("quizzes").select("status").eq("id", quiz_id).single().execute()
            print(f"\n❌ Quiz Generation Failed. Status: {quiz_status.data['status']}")

    except Exception as e:
        print(f"\n❌ Error during quiz generation: {e}")

if __name__ == "__main__":
    asyncio.run(test_quiz_generation())
