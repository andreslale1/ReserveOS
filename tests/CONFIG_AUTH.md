# Configuración de Auth pendiente (la corre el dueño del proyecto; no la hace el código)

Hoy la configuración de acceso de Supabase apunta a `http://localhost:3000`, con lista de redirecciones vacía. Mientras no se cambie,
los correos de **confirmar cuenta** y **recuperar contraseña** llevan a una dirección que no existe y el registro autónomo no cierra solo.

Comando (reemplaza `TU_TOKEN` por un token de acceso de Supabase; no lo guardes en ningún archivo):

```bash
curl -s -X PATCH "https://api.supabase.com/v1/projects/agkqppuhyltirrhngybq/config/auth" \
  -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" \
  -d '{"site_url":"https://reserveos.app","uri_allow_list":"https://reserveos.app/**,https://*.reserveos.app/**","password_min_length":8}'
```

- Los **dominios propios** de cada estudio (reservas.su-dominio.com) deben añadirse a `uri_allow_list` cuando se verifican.
- Sin servidor de correo propio (SMTP) Supabase limita los correos a 2 por hora: sirve para pruebas, no para lanzar. No se configuró SMTP (proveedor externo).
