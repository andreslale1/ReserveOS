-- Deja el espacio listo para las 5 integraciones pendientes (Recurrente, WhatsApp, email, push, FEL)
-- SIN construirlas — a petición explícita de Andrés: no se conecta nada real todavía, pero cuando se
-- conecte no hay que diseñar el esquema desde cero.
--
-- Los secretos (API keys, tokens) NUNCA se guardan en texto plano en estas tablas — se guardan en
-- Supabase Vault (`supabase_vault`, ya instalado en este proyecto) y la tabla solo referencia el
-- `secret_id`. Solo `service_role` puede leer el valor descifrado (`vault.decrypted_secrets`); ningún
-- rol de tenant, ni siquiera dueña, puede leer el secreto de vuelta una vez guardado — solo
-- sobreescribirlo. Esto es más estricto que texto plano en columna, a propósito: un API key de
-- pasarela de pago o de WhatsApp Business es tan sensible como la contraseña de un banco.

create or replace function public.guardar_secreto_integracion(p_tenant_id uuid, p_nombre text, p_valor text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_secret_id uuid;
begin
  if not public.staff_puede_en_sede(p_tenant_id, null, array['duena']) then
    raise exception 'Solo la dueña puede configurar credenciales de integración';
  end if;
  if coalesce(trim(p_valor), '') = '' then
    raise exception 'El valor del secreto no puede estar vacío';
  end if;
  select vault.create_secret(p_valor, p_tenant_id::text || ':' || p_nombre, 'Credencial de integración de ReserveOS') into v_secret_id;
  return v_secret_id;
end;
$$;
revoke all on function public.guardar_secreto_integracion(uuid, text, text) from public;
grant execute on function public.guardar_secreto_integracion(uuid, text, text) to authenticated;

create table public.integracion_pagos (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  proveedor text not null default 'recurrente',
  cuenta_comercial_id text,
  webhook_url text,
  secret_id uuid references vault.secrets(id),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger integracion_pagos_set_updated_at before update on public.integracion_pagos
  for each row execute function public.set_updated_at();

create table public.integracion_whatsapp (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  proveedor text not null default 'whatsapp_business_api',
  numero_telefono text,
  secret_id uuid references vault.secrets(id),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger integracion_whatsapp_set_updated_at before update on public.integracion_whatsapp
  for each row execute function public.set_updated_at();

create table public.integracion_email (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  proveedor text not null default 'resend',
  remitente_nombre text,
  remitente_email text,
  secret_id uuid references vault.secrets(id),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger integracion_email_set_updated_at before update on public.integracion_email
  for each row execute function public.set_updated_at();

create table public.integracion_push (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  apns_bundle_id text,
  apns_secret_id uuid references vault.secrets(id),
  fcm_sender_id text,
  fcm_secret_id uuid references vault.secrets(id),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger integracion_push_set_updated_at before update on public.integracion_push
  for each row execute function public.set_updated_at();

create table public.integracion_fel (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  proveedor_certificador text,
  nit_emisor text,
  usuario_api text,
  secret_id uuid references vault.secrets(id),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger integracion_fel_set_updated_at before update on public.integracion_fel
  for each row execute function public.set_updated_at();

alter table public.integracion_pagos enable row level security;
alter table public.integracion_whatsapp enable row level security;
alter table public.integracion_email enable row level security;
alter table public.integracion_push enable row level security;
alter table public.integracion_fel enable row level security;

-- Dueña administra completo; gerente_general solo lectura (mismo criterio que P28 de la matriz:
-- activar pasarela/cuenta comercial es exclusivo de dueña, sin G* para gerente).
create policy integracion_pagos_select on public.integracion_pagos for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
create policy integracion_whatsapp_select on public.integracion_whatsapp for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
create policy integracion_email_select on public.integracion_email for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
create policy integracion_push_select on public.integracion_push for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
create policy integracion_fel_select on public.integracion_fel for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general','contadora']));

grant select on public.integracion_pagos, public.integracion_whatsapp, public.integracion_email,
  public.integracion_push, public.integracion_fel to authenticated;
-- Sin INSERT/UPDATE/DELETE por RLS a propósito todavía: la escritura de estas 5 tablas se hace junto
-- con cada integración real (guardar_secreto_integracion() + una RPC dueña-only por integración que
-- valide su forma específica), no con un GRANT genérico de escritura sin la lógica que la acompañe.
revoke all on public.integracion_pagos, public.integracion_whatsapp, public.integracion_email,
  public.integracion_push, public.integracion_fel from anon;
