import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ai-backend"))
from business_plan_agent import _populate_strategic_document

answers = {"organizationName": "Test Company", "timeHorizon": "2027-2030 Strategic Plan"}
content = {
    "executiveSummary": "Test Company will expand its market reach, create jobs in its community, and strengthen reliable service delivery through focused execution and accountable leadership.",
    "currentPosition": "The business serves SMEs with reliable systems and is preparing for disciplined growth.",
    "vision": "To serve more customers while creating sustainable employment in the local community.",
    "mission": "To deliver reliable systems that help SMEs operate and grow with confidence.",
    "values": ["Integrity", "Honesty", "Trust", "Customer commitment"],
    "strategicContext": "Demand is growing, while customers increasingly expect dependable support, responsive service, and solutions that evolve with their needs.",
    "stakeholders": ["SME customers", "Employees", "Community partners", "Technology partners"],
    "swot": {"strengths": ["Trusted SME relationships", "Reliable delivery"], "weaknesses": ["Limited market reach", "Processes need scaling"], "opportunities": ["New target areas", "Partnership-led growth"], "threats": ["Competitive pressure", "Execution capacity"]},
    "objectives": [
        {"priority": "Market growth", "objective": "Grow the customer base in key target areas.", "measures": ["Qualified leads", "New customers", "Retention rate"], "initiatives": ["Define priority segments", "Launch targeted outreach"], "owner": "Commercial lead", "timing": "Year 1-3"},
        {"priority": "Service quality", "objective": "Improve customer satisfaction through reliable delivery.", "measures": ["Satisfaction score", "Resolution time"], "initiatives": ["Standardise service processes", "Introduce feedback reviews"], "owner": "Operations lead", "timing": "Year 1-2"},
        {"priority": "Operational efficiency", "objective": "Strengthen systems and team performance.", "measures": ["Cycle time", "Quality rate"], "initiatives": ["Document core workflows", "Build team capability"], "owner": "Executive team", "timing": "Year 1-3"},
    ],
    "implementationApproach": "Each priority will be translated into a funded annual operating plan with clear owners, milestones, dependencies, and quarterly decision reviews.",
    "resources": "Growth requires accountable leaders, fit-for-purpose systems, staff development, partnership capacity, and disciplined budgeting.",
    "governance": "The leadership team reviews delivery monthly, examines the scorecard quarterly, and refreshes the strategy annually.",
    "risks": [{"risk": "Insufficient delivery capacity", "response": "Phase growth, monitor workload, and recruit ahead of demand."}, {"risk": "Weak customer acquisition", "response": "Test channels quarterly and redirect investment using evidence."}],
}

output = _populate_strategic_document(answers, content)
target = Path(__file__).parent / "generated-strategic-plan.docx"
target.write_bytes(output.getvalue())
print(target)
