import asyncio
import os
import sys
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.database import supabase
from app.routers.quiz import _refresh_dashboard_snapshot

async def test_dashboard_refresh():
    course_id = "e9d119d3-a2e4-404d-80cd-94fcfb0fc16f"
    quiz_id = None # Optional for the function
    
    print(f"--- [Dashboard Test] Refreshing Dashboard for Course: {course_id} ---")
    
    try:
        # Mocking weak_concepts
        weak_concepts = ["CPU Scheduling", "FCFS", "SJF"]
        _refresh_dashboard_snapshot(course_id, quiz_id, weak_concepts)
        
        # Check result
        res = supabase.table("dashboard_snapshots").select("*").eq("course_id", course_id).single().execute()
        data = res.data
        
        print("\n✅ Dashboard Refresh COMPLETED!")
        import json
        print(f"Average Accuracy: {data['average_accuracy']}")
        print(f"Uploaded Weeks: {data['uploaded_weeks']}")
        print(f"Total Weeks: {data['total_weeks']}")
        print("Weekly Stats:")
        print(json.dumps(data['weekly_stats'], indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"\n❌ Error during dashboard refresh: {e}")

if __name__ == "__main__":
    asyncio.run(test_dashboard_refresh())
