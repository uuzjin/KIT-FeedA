import asyncio
import os
import sys
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.database import supabase
from app.core.storage import BUCKET_SCRIPTS
from app.routers.analysis import trigger_structure_analysis, _run_structure

async def run_e2e_test():
    course_id = "e9d119d3-a2e4-404d-80cd-94fcfb0fc16f"
    instructor_id = "347b314a-4ec3-4c9a-a597-79d919452d19"
    file_path = "lecture_sample.txt"
    
    print(f"--- [Step 1] Uploading script: {file_path} ---")
    with open(file_path, "rb") as f:
        file_content = f.read()
    
    storage_path = f"courses/{course_id}/scripts/lecture_sample_{int(datetime.now().timestamp())}.txt"
    
    # Upload to storage
    supabase.storage.from_(BUCKET_SCRIPTS).upload(
        path=storage_path,
        file=file_content,
        file_options={"content-type": "text/plain", "upsert": "true"}
    )
    print(f"File uploaded to {storage_path}")
    
    # Insert into scripts table
    script_res = supabase.table("scripts").insert({
        "course_id": course_id,
        "title": "CPU Scheduling Lecture",
        "file_name": "lecture_sample.txt",
        "file_size": len(file_content),
        "mime_type": "text/plain",
        "content_path": storage_path,
        "week_number": 1
    }).execute()
    
    script_id = script_res.data[0]["id"]
    print(f"Script record created with ID: {script_id}")
    
    print(f"\n--- [Step 2] Triggering AI Structure Analysis ---")
    
    # Delete existing record if any (workaround for missing unique constraint)
    supabase.table("script_post_analyses").delete().eq("script_id", script_id).eq("analysis_type", "structure").execute()
    
    # Create the record
    analysis_res = supabase.table("script_post_analyses").insert(
        {"script_id": script_id, "analysis_type": "structure", "status": "pending"}
    ).execute()
    record_id = analysis_res.data[0]["id"]
    
    print("AI Analysis in progress (Gemini)...")
    try:
        # Run the internal analysis function
        _run_structure(record_id, course_id, script_id)
        
        # Check result
        result_res = supabase.table("script_post_analyses").select("*").eq("id", record_id).single().execute()
        analysis_data = result_res.data
        
        if analysis_data["status"] == "completed":
            print("\n✅ AI Analysis COMPLETED!")
            print("Analysis Result Summary:")
            import json
            print(json.dumps(analysis_data["result"], indent=2, ensure_ascii=False))
        else:
            print(f"\n❌ AI Analysis FAILED or STUCK: {analysis_data.get('status')}")
            print(f"Error: {analysis_data.get('error_message')}")
            
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
