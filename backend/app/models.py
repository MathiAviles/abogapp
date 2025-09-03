from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import CheckConstraint, UniqueConstraint

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'cliente' | 'abogado' | 'admin' | 'backoffice'
    identificacion = db.Column(db.String(50), nullable=False)
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    especialidad = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Aprobación final (derivada por recompute_approval)
    is_approved = db.Column(db.Boolean, default=False, nullable=False)

    created_by = db.Column(db.Integer, nullable=True)
    about_me = db.Column(db.Text, nullable=True)
    titles = db.Column(db.Text, nullable=True)
    profile_picture_url = db.Column(db.String(200), nullable=True)
    consultation_price = db.Column(db.Float, nullable=True)

    availabilities = db.relationship('Availability', backref='lawyer', lazy=True, cascade="all, delete-orphan")
    meetings_as_client = db.relationship('Meeting', foreign_keys='Meeting.client_id', backref='client', lazy=True)
    meetings_as_lawyer = db.relationship('Meeting', foreign_keys='Meeting.lawyer_id', backref='lawyer_user', lazy=True)

    # Email verification
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    email_verif_code_hash = db.Column(db.String(255), nullable=True)
    email_verif_expires = db.Column(db.DateTime, nullable=True)

    # Reset password
    reset_code_hash = db.Column(db.String(255), nullable=True)
    reset_code_expires = db.Column(db.DateTime, nullable=True)

    # KYC
    kyc_status = db.Column(db.String(20), default="not_submitted", nullable=False)  # not_submitted | pending | approved | rejected
    kyc_submitted_at = db.Column(db.DateTime, nullable=True)
    kyc_notes = db.Column(db.Text, nullable=True)
    kyc_doc_front_url = db.Column(db.String(255), nullable=True)
    kyc_doc_back_url = db.Column(db.String(255), nullable=True)
    kyc_selfie_url = db.Column(db.String(255), nullable=True)
    kyc_bar_number = db.Column(db.String(100), nullable=True)

    def recompute_approval(self):
        """Aprobación unificada: necesita email verificado y (si es abogado) KYC aprobado."""
        ok_email = bool(self.email_verified)
        ok_kyc = True if self.role != "abogado" else (self.kyc_status == "approved")
        self.is_approved = bool(ok_email and ok_kyc)

class Availability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    time_slots = db.Column(db.JSON, nullable=False)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_date = db.Column(db.Date, nullable=False)
    meeting_time = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), default='confirmada', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    client_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # Precio congelado por reunión
    price_at_booking_cents = db.Column(db.Integer, nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default='USD')

class Review(db.Model):
    __tablename__ = 'review'
    id = db.Column(db.Integer, primary_key=True)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meeting.id'), nullable=True)
    rating = db.Column(db.Integer, nullable=False)  # 1..5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint('rating BETWEEN 1 AND 5', name='ck_review_rating_1_5'),
        UniqueConstraint('client_id', 'meeting_id', name='uq_review_client_meeting'),
    )

class Favorite(db.Model):
    __tablename__ = 'favorite'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'lawyer_id', name='uq_favorite_user_lawyer'),
    )

class MeetingPresence(db.Model):
    __tablename__ = 'meeting_presence'
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meeting.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('user.id'),    nullable=False)
    role       = db.Column(db.String(20), nullable=False)  # 'cliente' | 'abogado'
    joined_at  = db.Column(db.DateTime, nullable=True)
    left_at    = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('meeting_id', 'user_id', name='uq_meeting_user'),
    )

class LawyerGalleryImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LawyerIntroVideo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lawyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, unique=True, nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)