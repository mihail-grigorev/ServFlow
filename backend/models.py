from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # dispatcher, engineer, company
    city = Column(String(50), nullable=True)   # Москва, Тула
    company_id = Column(String(50), nullable=True, index=True)  # comp_kedr, etc.
    is_demo = Column(Boolean, default=False, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    is_senior = Column(Boolean, default=False)
    qualifications = Column(JSON, default=list)  # ["C100", "C200", "C300"]
    avatar_url = Column(Text, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("ServiceOrder", back_populates="engineer", foreign_keys="[ServiceOrder.engineer_id]")
    threads = relationship("ClientThread", back_populates="owner", foreign_keys="[ClientThread.owner_user_id]")


class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # EQ01..EQ12
    client_name = Column(String(255), nullable=False, index=True)
    company_id = Column(String(50), nullable=True, index=True)
    address = Column(String(255), nullable=False)
    city = Column(String(50), nullable=False)  # Москва, Тула
    model = Column(String(50), nullable=False)  # C100, C200, C300
    serial_number = Column(String(50), nullable=False, index=True)
    installation_date = Column(DateTime, nullable=False)
    last_visit_date = Column(DateTime, nullable=True)
    last_visit_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    threads = relationship("ClientThread", back_populates="equipment")
    orders = relationship("ServiceOrder", back_populates="equipment")


class SparePart(Base):
    __tablename__ = "spare_parts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # G100, P120, etc.
    name = Column(String(255), nullable=False)
    compatible_models = Column(JSON, default=list)  # ["C100", "C200"]
    moscow_stock = Column(Integer, default=0)
    moscow_reserved = Column(Integer, default=0)
    tula_stock = Column(Integer, default=0)
    tula_reserved = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClientThread(Base):
    __tablename__ = "client_threads"

    id = Column(Integer, primary_key=True, index=True)
    thread_number = Column(Integer, unique=True, index=True, nullable=False)
    client_name = Column(String(255), nullable=False, index=True)
    company_id = Column(String(50), nullable=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)
    equipment_code = Column(String(50), nullable=True)
    status = Column(String(50), default="new")  # new, needs_clarification, ready_for_order, order_created, sales_transfer, resolved
    channel = Column(String(50), default="Почта")  # Почта, Звонок, Мессенджер
    is_warranty = Column(Boolean, default=False)
    warranty_reason = Column(Text, nullable=True)
    is_unregistered = Column(Boolean, default=False)
    last_activity = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="threads", foreign_keys=[owner_user_id])
    equipment = relationship("Equipment", back_populates="threads")
    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan", order_by="Message.id")
    orders = relationship("ServiceOrder", back_populates="thread")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("client_threads.id"), nullable=False, index=True)
    request_code = Column(String(50), nullable=True)  # З-01..З-23
    channel = Column(String(50), nullable=False)      # Почта, Звонок, Мессенджер
    chat_type = Column(String(50), default="client_dispatcher", nullable=True)  # client_dispatcher, dispatcher_engineer, client_engineer
    sender_type = Column(String(50), nullable=False)  # client, dispatcher, engineer, system
    sender_name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    thread = relationship("ClientThread", back_populates="messages")


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(100), unique=True, index=True, nullable=False)
    thread_id = Column(Integer, ForeignKey("client_threads.id"), nullable=True)
    client_name = Column(String(255), nullable=False)
    company_id = Column(String(50), nullable=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=True)
    equipment_code = Column(String(50), nullable=True)
    address = Column(String(255), nullable=False)
    model = Column(String(50), nullable=False)
    serial_number = Column(String(50), nullable=False)
    symptom = Column(Text, nullable=False)
    client_assumption = Column(Text, nullable=True)
    is_warranty = Column(Boolean, default=False)
    warranty_reason = Column(Text, nullable=True)
    is_sales_transfer = Column(Boolean, default=False)
    status = Column(String(50), default="Назначен")  # Назначен, В пути, На месте, Выполнен, Отменен
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reserved_parts = Column(JSON, default=list)  # [{"code": "G100", "name": "...", "quantity": 1, "city": "Москва", "transfer_required": false}]
    inspection_report = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    thread = relationship("ClientThread", back_populates="orders")
    equipment = relationship("Equipment", back_populates="orders")
    engineer = relationship("User", back_populates="orders", foreign_keys=[engineer_id])


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    code = Column(String(10), nullable=False)
    code_hash = Column(String(128), nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    purpose = Column(String(50), nullable=False)  # "register", "delete_account", "change_email"
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    ts = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    ip = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    object = Column(String(100), nullable=True)
    details = Column(JSON, default=dict)


class DemoQrToken(Base):
    __tablename__ = "demo_qr_tokens"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(String(50), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    uses = Column(Integer, default=0, nullable=False)
    max_uses = Column(Integer, default=30, nullable=False)
