"""
Browser Automation Agent
========================
AI-powered browser automation with natural language goals.

Usage:
    python main.py                    # Interactive mode
    python main.py --goal "..."       # Run with goal
    python main.py --replay <id>      # Replay session
    python main.py --list-sessions    # List sessions
"""

import asyncio
import argparse
import sys

from core.orchestrator import Orchestrator


async def interactive_mode(orchestrator: Orchestrator) -> None:
    """Run agent in interactive mode."""
    print("\n🤖 Browser Automation Agent")
    print("=" * 50)
    print("Type your goal, or:")
    print("  'replay <session_id>' - Replay a session")
    print("  'sessions' - List logged sessions")
    print("  'exit' - Exit the agent")
    print("=" * 50)
    
    while True:
        try:
            user_input = input("\n🎯 Enter goal: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() == "exit":
                break
            
            if user_input.lower() == "sessions":
                sessions = await orchestrator.list_sessions()
                print(f"\n📋 Logged Sessions ({len(sessions)}):")
                for s in sessions[:10]:
                    status = "✅" if s.get("success") else "❌"
                    print(f"  {status} {s.get('session_id')} - {s.get('goal', '')[:40]}")
                continue
            
            if user_input.lower().startswith("replay "):
                session_id = user_input[7:].strip()
                await orchestrator.replay(session_id)
                continue
            
            # Run with goal
            await orchestrator.run(user_input)
            
        except KeyboardInterrupt:
            print("\n\n⚠️ Interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


async def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="AI-powered browser automation agent"
    )
    parser.add_argument(
        "--goal", "-g",
        type=str,
        help="Goal to execute"
    )
    parser.add_argument(
        "--replay", "-r",
        type=str,
        help="Session ID to replay"
    )
    parser.add_argument(
        "--list-sessions", "-l",
        action="store_true",
        help="List logged sessions"
    )
    parser.add_argument(
        "--speed", "-s",
        type=float,
        default=1.0,
        help="Replay speed (default: 1.0)"
    )
    
    args = parser.parse_args()
    
    async with Orchestrator() as orchestrator:
        if args.list_sessions:
            sessions = await orchestrator.list_sessions()
            print(f"\n📋 Logged Sessions ({len(sessions)}):")
            for s in sessions:
                status = "✅" if s.get("success") else "❌"
                print(f"  {status} {s.get('session_id')} - {s.get('goal', '')[:50]}")
        
        elif args.replay:
            await orchestrator.replay(args.replay, args.speed)
        
        elif args.goal:
            await orchestrator.run(args.goal)
        
        else:
            await interactive_mode(orchestrator)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)
