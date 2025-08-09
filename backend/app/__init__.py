import os
from flask import Flask
from flask_jwt_extended import JWTManager
from .models import db
from flask_cors import CORS
from datetime import timedelta
from stream_chat import StreamChat

def create_app():
    app = Flask(__name__)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../instance/users.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'una-clave-super-secreta-y-larga-para-produccion'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

    # --- INICIO: Modificaciones para GetStream.io ---
    # Carga las credenciales de GetStream desde variables de entorno
    app.config['STREAM_API_KEY'] = os.environ.get('STREAM_API_KEY')
    app.config['STREAM_API_SECRET'] = os.environ.get('STREAM_API_SECRET')
    # --- FIN: Modificaciones para GetStream.io ---

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
    JWTManager(app)

    from .routes.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .routes.admin import admin_bp
    app.register_blueprint(admin_bp)
    
    from .routes.lawyers import lawyers_bp
    app.register_blueprint(lawyers_bp)
    
    # Registro del nuevo blueprint de reuniones
    from .routes.meetings import meetings_bp
    app.register_blueprint(meetings_bp)

    with app.app_context():
        db.create_all()

    return app