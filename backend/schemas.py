from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ----------------- Auth & Users -----------------
class UserBase(BaseModel):
    email: str
    full_name: str
    role: str  # dispatcher, engineer
    city: Optional[str] = None
    is_senior: bool = False
    qualifications: List[str] = Field(default_factory=list)
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    is_senior: Optional[bool] = None
    qualifications: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ----------------- Equipment -----------------
class EquipmentCreate(BaseModel):
    code: Optional[str] = None
    client_name: Optional[str] = None
    address: str
    city: Optional[str] = "Москва"
    model: str
    serial_number: str
    installation_date: Optional[datetime] = None

class EquipmentResponse(BaseModel):
    id: int
    code: str
    client_name: str
    address: str
    city: str
    model: str
    serial_number: str
    installation_date: datetime
    last_visit_date: Optional[datetime] = None
    last_visit_result: Optional[str] = None

    class Config:
        from_attributes = True

# ----------------- Spare Parts -----------------
class SparePartResponse(BaseModel):
    id: int
    code: str
    name: str
    compatible_models: List[str]
    moscow_stock: int
    moscow_reserved: int
    moscow_free: int
    tula_stock: int
    tula_reserved: int
    tula_free: int

    class Config:
        from_attributes = True

class ReservedPartItem(BaseModel):
    code: str
    name: str
    quantity: int = 1
    source_city: str  # Москва, Тула
    transfer_required: bool = False

# ----------------- Messages -----------------
class MessageCreate(BaseModel):
    content: str
    channel: Optional[str] = "Мессенджер"
    chat_type: Optional[str] = "client_dispatcher"  # client_dispatcher, dispatcher_engineer, client_engineer
    sender_type: Optional[str] = "dispatcher"
    sender_name: Optional[str] = "Диспетчер"

class MessageResponse(BaseModel):
    id: int
    thread_id: int
    request_code: Optional[str] = None
    channel: str
    chat_type: Optional[str] = "client_dispatcher"
    sender_type: str
    sender_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Client Threads -----------------
class ClientThreadResponse(BaseModel):
    id: int
    thread_number: int
    client_name: str
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    status: str
    channel: str
    is_warranty: bool
    warranty_reason: Optional[str] = None
    is_unregistered: bool
    last_activity: datetime
    created_at: datetime
    messages: List[MessageResponse] = Field(default_factory=list)
    equipment: Optional[EquipmentResponse] = None
    linked_order_number: Optional[str] = None
    assigned_engineer_name: Optional[str] = None
    assigned_engineer_id: Optional[int] = None

    class Config:
        from_attributes = True

class CreateThreadRequest(BaseModel):
    client_name: Optional[str] = None
    equipment_code: Optional[str] = None
    channel: str = "Мессенджер"
    content: str

class SimulateCustomerMessageRequest(BaseModel):
    client_name: str
    channel: str = "Мессенджер"  # Почта, Звонок, Мессенджер
    content: str
    request_code: Optional[str] = None

# ----------------- AI Analysis -----------------
class RecommendedPartCandidate(BaseModel):
    code: str
    name: str
    is_compatible: bool
    local_stock: int
    local_reserved: int
    local_free: int
    other_city_free: int
    transfer_required: bool
    status_note: str
    diagnostic_reason: Optional[str] = None

class AIAnalysisResult(BaseModel):
    detected_equipment_code: Optional[str] = None
    detected_model: Optional[str] = None
    detected_serial: Optional[str] = None
    equipment_reasoning: Optional[str] = None
    is_unregistered_machine: bool = False
    is_ambiguous_machine: bool = False
    ambiguity_explanation: Optional[str] = None
    is_warranty: bool = False
    warranty_reason: Optional[str] = None
    error_code: Optional[str] = None
    error_explanation: Optional[str] = None
    draft_symptom: str
    client_assumption: Optional[str] = None
    reply_to_client: str
    missing_questions: List[str] = Field(default_factory=list)
    recommended_parts: List[RecommendedPartCandidate] = Field(default_factory=list)
    rules_applied: List[str] = Field(default_factory=list)

class AIReplyGenerateRequest(BaseModel):
    thread_id: int
    custom_instruction: Optional[str] = None

class AITextAnalysisRequest(BaseModel):
    text: str
    client_name: Optional[str] = None

# ----------------- Orders -----------------
class ServiceOrderCreate(BaseModel):
    thread_id: Optional[int] = None
    client_name: str
    equipment_code: Optional[str] = None
    address: str
    model: str
    serial_number: str
    symptom: str
    client_assumption: Optional[str] = None
    is_warranty: bool = False
    warranty_reason: Optional[str] = None
    is_sales_transfer: bool = False
    engineer_id: Optional[int] = None
    reserved_parts: List[ReservedPartItem] = Field(default_factory=list)
    created_at: Optional[datetime] = None

class ServiceOrderStatusUpdate(BaseModel):
    status: str  # Назначен, В пути, На месте, Выполнен, Отменен

class ServiceOrderUpdate(BaseModel):
    client_name: Optional[str] = None
    address: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    symptom: Optional[str] = None
    client_assumption: Optional[str] = None
    is_warranty: Optional[bool] = None
    warranty_reason: Optional[str] = None
    status: Optional[str] = None
    engineer_id: Optional[int] = None
    reserved_parts: Optional[List[ReservedPartItem]] = None
    inspection_report: Optional[str] = None

class ServiceOrderReportUpdate(BaseModel):
    inspection_report: str
    status: Optional[str] = "Выполнен"

class ServiceOrderResponse(BaseModel):
    id: int
    order_number: str
    thread_id: Optional[int] = None
    client_name: str
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    address: str
    model: str
    serial_number: str
    symptom: str
    client_assumption: Optional[str] = None
    is_warranty: bool
    warranty_reason: Optional[str] = None
    is_sales_transfer: bool
    status: str
    engineer_id: Optional[int] = None
    engineer: Optional[UserResponse] = None
    reserved_parts: List[Dict[str, Any]] = Field(default_factory=list)
    inspection_report: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
