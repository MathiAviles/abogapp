from .chat import chat_bp

def register_blueprints(app):
    # ... otros blueprints
    app.register_blueprint(chat_bp)
