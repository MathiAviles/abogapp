# ABOGAPP

## Pasos para Dev

1. Clonar repositorio
2. Crear un archivo .env (en carpeta raiz y otro en frontend) basado en .env.template
2. Ejecutar docker-compose para instalar dependencias y levantar servicios

## Comandos
### Levantar app
<pre><code> 
docker-compose up -d
</code></pre>

### Construir build de frontend
<pre><code>
docker-compose exec frontend npm run build
sudo chmod -R 777 dist
</code></pre>

