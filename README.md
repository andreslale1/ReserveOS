# ReserveOS

Repo separado para la plataforma multi-tenant (VIM Pilates es el primer tenant). **No toca el repo,
base de datos ni despliegue de Forma Pilates** (`~/Desktop/Forma Pilates/Frontend`) — ver Regla 1 y 2
del documento maestro.

Fuente de verdad de producto/arquitectura: `~/Desktop/MAESTRO_Forma_SaaS_Instrucciones_Desarrollo.md`

## Estado — Hito A (auditoría y oferta)

- [x] Inventario estático de tablas desde `migrations/*.sql` de Forma real → `auditoria/01_inventario_estatico_tablas.md`
- [x] Cruce contra el inventario del documento técnico (46 tablas, coinciden 1:1 salvo `cierres_caja_pos` ya eliminada)
- [ ] Dump del esquema real (`information_schema` + `pg_policies`) — **bloqueado: requiere `supabase login`**
- [ ] Reconciliar RLS + GRANT reales contra lo documentado
- [ ] Marcar tablas/RPCs necesarias para el núcleo del Hito C vs. el resto
- [ ] Proyecto de Supabase nuevo (staging) para ReserveOS — separado del de Forma
- [ ] Entrevista VIM, precio, app y pagos pactados (cierra Hito A)

Siguiente hito (B): esquema base multi-tenant (`tenants`, `sedes`, `tenant_memberships`, `staff_sedes`,
`module_catalog`, `tenant_entitlements`, `tenant_module_settings`, `role_permissions`) + RLS de
aislamiento probado con dos tenants ficticios antes de tocar cualquier tabla de negocio.
