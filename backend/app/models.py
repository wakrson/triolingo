# pyrefly: ignore [missing-import]
from pydantic import BaseModel


class UserProfile(BaseModel):
    language: str
    goal: str
    timeline: str
    experience_level: str


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    difficulty: int
    tags: list[str]
    status: str = "unknown"


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class KnowledgeGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class PersonalizeResponse(BaseModel):
    graph: KnowledgeGraph
    user_id: str
    llm_system: str
    llm_prompt: str
    llm_response: str


class AssessmentRequest(BaseModel):
    user_id: str
    graph: KnowledgeGraph
    region: str | None = None


class AssessmentAnswer(BaseModel):
    user_id: str
    question_id: str
    answer: str


class ExerciseRequest(BaseModel):
    user_id: str
    node_id: str


class GradeRequest(BaseModel):
    user_id: str
    node_id: str
    exercise_id: str
    answer: str


class ChatRequest(BaseModel):
    user_id: str
    message: str


class Message(BaseModel):
    role: str
    content: str


class ChatResponse(BaseModel):
    message: str
    recommended_nodes: list[dict] = []
