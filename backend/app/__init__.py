# backend/app/__init__.py
import os
import mimetypes
from datetime import timedelta
from flask import Flask, request, send_file, abort
from flask_jwt_extended import JWTManager
from flask_cors import CORS

from .models import db

try:
    from flask_migrate import Migrate
    migrate = Migrate()
except Exception:
    migrate = None


def create_app():
    # instance_relative_config=True nos deja apuntar fácil a /instance
    app = Flask(__name__, instance_relative_config=True)

    # ---------- Configuración básica ----------
    # Asegura que la carpeta instance exista
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass

    # DB en instance/users.db (ruta absoluta y estable)
    db_path = os.path.join(app.instance_path, 'users.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        f"sqlite:///{db_path}"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # JWT
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-me')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=12)
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    app.config['JWT_COOKIE_SECURE'] = False

    # Stream (si los usas en otros módulos)
    app.config['STREAM_API_KEY'] = os.environ.get('STREAM_API_KEY')
    app.config['STREAM_API_SECRET'] = os.environ.get('STREAM_API_SECRET')

    # ---------- CORS ----------
    frontend_env = os.environ.get('FRONTEND_URL', '').strip()
    cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    if frontend_env and frontend_env not in cors_origins:
        cors_origins.append(frontend_env)

    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Authorization", "Content-Type"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    @app.before_request
    def _cors_preflight_shortcircuit():
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            return ("", 204)

    # ---------- Tipos MIME para /uploads ----------
    mimetypes.add_type('image/webp', '.webp')
    mimetypes.add_type('image/jpeg', '.jpg')
    mimetypes.add_type('image/jpeg', '.jpeg')
    mimetypes.add_type('image/png',  '.png')

    # Servir archivos subidos
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))

    @app.route('/uploads/<path:filename>')
    def uploads(filename):
        path = os.path.join(uploads_dir, filename)
        if not os.path.isfile(path):
            abort(404)
        mime, _ = mimetypes.guess_type(path)
        resp = send_file(path, mimetype=mime or 'application/octet-stream', conditional=True)
        # Evita disposición como adjunto
        resp.headers.pop('Content-Disposition', None)
        resp.headers['Cache-Control'] = 'public, max-age=3600'
        return resp

    # ---------- Inicializar extensiones ----------
    db.init_app(app)
    JWTManager(app)
    if migrate is not None:
        migrate.init_app(app, db)

    # ---------- Blueprints ----------
    
    from .routes.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .routes.admin import admin_bp
    app.register_blueprint(admin_bp)  # expone /api/admin/...

    from .routes.lawyers import lawyers_bp
    app.register_blueprint(lawyers_bp)

    from .routes.meetings import meetings_bp
    app.register_blueprint(meetings_bp)

    from .routes.user import user_bp
    app.register_blueprint(user_bp)

    from .routes.chat import chat_bp
    app.register_blueprint(chat_bp)

    from .routes.reviews import reviews_bp
    app.register_blueprint(reviews_bp, url_prefix='/api')

    from .routes.favorites import favorites_bp
    app.register_blueprint(favorites_bp)

    from .routes.kyc import kyc_bp
    app.register_blueprint(kyc_bp)

    # ---------- Rutas utilitarias ----------
    @app.get("/ping")
    def ping():
        return {"ok": True, "service": "abogapp-backend"}

    # ---------- Crear tablas si no existen ----------
    with app.app_context():
        db.create_all()

    return app