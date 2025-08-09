from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    identificacion = db.Column(db.String(50), nullable=False)
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    especialidad = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_approved = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, nullable=True)
    about_me = db.Column(db.Text, nullable=True)
    titles = db.Column(db.Text, nullable=True)
    profile_picture_url = db.Column(db.String(200), nullable=True)
    consultation_price = db.Column(db.Float, nullable=True)

    availabilities = db.relationship('Availability', backref='lawyer', lazy=True, cascade="all, delete-orphan")
    meetings_as_client = db.relationship('Meeting', foreign_keys='Meeting.client_id', backref='client', lazy=True)
    meetings_as_lawyer = db.relationship('Meeting', foreign_keys='Meeting.lawyer_id', backref='lawyer_user', lazy=True)

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