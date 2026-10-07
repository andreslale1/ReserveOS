-- La migración de roles del estudio (20261005240000) quitó 'duena' del check de invitaciones_personal y dejó rota la invitación
-- de la primera dueña (invitar_primera_duena_plataforma): el alta de un estudio nuevo fallaba al invitarla. Se restituye.
-- crear_invitacion_personal sigue sin permitir invitar dueñas: valida la jerarquía de roles por su cuenta.
alter table public.invitaciones_personal drop constraint if exists invitaciones_personal_role_check;
alter table public.invitaciones_personal add constraint invitaciones_personal_role_check
  check (role in ('duena','gerente_general','gerente_regional','admin_sede','recepcion','instructora','contadora','marketing'));
