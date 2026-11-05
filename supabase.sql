-- Tatan: base de datos con usuarios y permisos por sector
-- Se pega en Supabase → SQL Editor → Run. Se puede volver a correr cuando haya una versión nueva: no borra datos.

-- 1) Perfiles: quién es cada usuario y a qué sector pertenece
create table if not exists perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  rol text not null default 'pendiente' check (rol in ('todo','local','cocina','pendiente'))
);
alter table perfiles add column if not exists email text not null default '';
alter table perfiles enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on perfiles to authenticated;
grant usage on schema public to service_role;
grant select on perfiles to service_role;

create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as
$$ select rol from perfiles where id = auth.uid() $$;

drop policy if exists "ver mi perfil o todo" on perfiles;
create policy "ver mi perfil o todo" on perfiles for select
  using (id = auth.uid() or mi_rol() = 'todo');
drop policy if exists "solo todo edita perfiles" on perfiles;
create policy "solo todo edita perfiles" on perfiles for all
  using (mi_rol() = 'todo') with check (mi_rol() = 'todo');

-- Invitaciones: SOLO puede crear usuario quien tenga su mail invitado (lo cargan las dueñas o administración en Equipo).
-- Cualquier otro mail es rechazado por la base, aunque alguien encuentre el link de la app.
create table if not exists invitaciones (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nombre text not null default '',
  rol text not null check (rol in ('todo','local','cocina')),
  creada timestamptz not null default now(),
  creada_por uuid default auth.uid(),
  usada timestamptz
);
alter table invitaciones enable row level security;
grant select, insert, update, delete on invitaciones to authenticated;
grant select on invitaciones to service_role;
drop policy if exists "solo todo maneja invitaciones" on invitaciones;
create policy "solo todo maneja invitaciones" on invitaciones for all
  using (mi_rol() = 'todo') with check (mi_rol() = 'todo');
-- Las dueñas que arrancan con acceso a todo. Las demás personas se invitan desde la app.
insert into invitaciones(email, nombre, rol) values
  ('gabrielabarillari@gmail.com', 'Gaba', 'todo'),
  ('tatanpatisserie@gmail.com', 'Tatan', 'todo')
on conflict (email) do nothing;

create or replace function nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitaciones;
begin
  select * into inv from invitaciones where email = lower(new.email) and usada is null;
  if inv.email is null then
    raise exception 'TATAN_NO_INVITADO' using errcode = 'P0001';
  end if;
  insert into perfiles(id, nombre, rol, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nombre',''), nullif(inv.nombre,''), split_part(new.email,'@',1)),
          inv.rol, lower(new.email));
  update invitaciones set usada = now() where email = inv.email;
  return new;
end $$;
drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse after insert on auth.users for each row execute function nuevo_perfil();

-- 2) Una tabla por sección. Cada fila es un registro (id + datos)
do $$
declare t text;
begin
  foreach t in array array['pedidos','presupuestos','gastos','clientes','recetas','insumos','stockpt','produccion','proveedores','movprov','empleados','horas','novedades','config'] loop
    execute format('create table if not exists %I (id text primary key, data jsonb not null default ''{}'', updated_at timestamptz not null default now(), updated_by uuid default auth.uid())', t);
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant select on %I to service_role', t);
    execute format('drop policy if exists "todo ve y edita" on %I', t);
    execute format('create policy "todo ve y edita" on %I for all using (mi_rol() = ''todo'') with check (mi_rol() = ''todo'')', t);
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- 3) Local: ventas, presupuestos, clientes, stock de producto terminado y producción
do $$
declare t text;
begin
  foreach t in array array['pedidos','presupuestos','clientes','stockpt','produccion'] loop
    execute format('drop policy if exists "local ve y edita" on %I', t);
    execute format('create policy "local ve y edita" on %I for all using (mi_rol() = ''local'') with check (mi_rol() = ''local'')', t);
  end loop;
end $$;
-- Local puede cargar facturas y remitos de proveedores, pero no ver los gastos
drop policy if exists "local carga gastos" on gastos;
create policy "local carga gastos" on gastos for insert with check (mi_rol() = 'local');
-- Local ve la lista de proveedores (para elegirlo) y carga facturas y remitos, sin ver saldos ni historial
drop policy if exists "local lee proveedores" on proveedores;
create policy "local lee proveedores" on proveedores for select using (mi_rol() = 'local');
drop policy if exists "local carga comprobantes" on movprov;
create policy "local carga comprobantes" on movprov for insert with check (mi_rol() = 'local');
-- Local lee la lista de precios y los datos del negocio (no los costos)
drop policy if exists "local lee config" on config;
create policy "local lee config" on config for select using (mi_rol() = 'local' and id in ('negocio','catalogo'));

-- 4) Cocina: producción y stock de producto terminado completos
do $$
declare t text;
begin
  foreach t in array array['stockpt','produccion'] loop
    execute format('drop policy if exists "cocina ve y edita" on %I', t);
    execute format('create policy "cocina ve y edita" on %I for all using (mi_rol() = ''cocina'') with check (mi_rol() = ''cocina'')', t);
  end loop;
end $$;

-- 4b) Cocina no puede cambiar el mínimo ni la cantidad ideal del stock de producto terminado (solo local y administración)
create or replace function proteger_minimos_stockpt() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() = 'cocina' then
    if tg_op = 'UPDATE' then
      new.data := jsonb_set(jsonb_set(new.data, '{minimo}', coalesce(old.data->'minimo', 'null'::jsonb)), '{objetivo}', coalesce(old.data->'objetivo', 'null'::jsonb));
    else
      new.data := new.data - 'minimo' - 'objetivo';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists stockpt_minimos on stockpt;
create trigger stockpt_minimos before insert or update on stockpt for each row execute function proteger_minimos_stockpt();

-- Cocina ve los pedidos SIN precios ni pagos
create or replace function pedidos_cocina() returns table(id text, data jsonb)
language sql stable security definer set search_path = public as $$
  select p.id,
    jsonb_strip_nulls(jsonb_build_object(
      'clienteNombre', p.data->'clienteNombre', 'entrega', p.data->'entrega', 'hora', p.data->'hora',
      'estado', p.data->'estado', 'notas', p.data->'notas', 'canal', p.data->'canal',
      'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i->'nombre', 'cant', i->'cant', 'listo', i->'listo', 'listoEn', i->'listoEn') order by n)
                         from jsonb_array_elements(p.data->'items') with ordinality as x(i, n)), '[]'::jsonb)))
  from pedidos p
  where mi_rol() in ('cocina','todo','local')
    and coalesce(p.data->>'estado','pendiente') in ('pendiente','produccion','listo')
$$;

-- Cocina tilda un ítem del pedido como listo
create or replace function marcar_item_pedido(p_id text, p_idx int, p_listo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d jsonb; total int; listos int; est text;
begin
  if coalesce(mi_rol(),'') not in ('todo','local','cocina') then raise exception 'sin permiso'; end if;
  select data into d from pedidos where id = p_id for update;
  if d is null then raise exception 'no existe'; end if;
  if p_idx is null or p_idx < 0 or p_idx >= jsonb_array_length(coalesce(d->'items','[]'::jsonb)) then raise exception 'ítem inválido'; end if;
  d := jsonb_set(d, array['items', p_idx::text, 'listo'], to_jsonb(p_listo));
  d := jsonb_set(d, array['items', p_idx::text, 'listoEn'], to_jsonb(case when p_listo then now()::text else '' end));
  select count(*), count(*) filter (where (i->>'listo')::boolean) into total, listos from jsonb_array_elements(d->'items') i;
  est := coalesce(d->>'estado','pendiente');
  if listos = total then est := 'listo'; elsif listos > 0 then est := 'produccion'; elsif est in ('listo','produccion') then est := 'pendiente'; end if;
  d := jsonb_set(d, '{estado}', to_jsonb(est));
  update pedidos set data = d, updated_at = now(), updated_by = auth.uid() where id = p_id;
end $$;

-- Cocina ve el stock de materia prima SIN precios
create or replace function insumos_cocina() returns table(id text, data jsonb)
language sql stable security definer set search_path = public as $$
  select id, data - 'precio' - 'proveedor' from insumos where mi_rol() in ('cocina','todo')
$$;

-- Cocina actualiza el stock y el mínimo de un insumo (nada más)
create or replace function ajustar_insumo(p_id text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare limpio jsonb;
begin
  if mi_rol() not in ('cocina','todo') then raise exception 'sin permiso'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into limpio
    from jsonb_each(p_patch) where key in ('stock','minimo','ultimoMov');
  update insumos set data = data || limpio, updated_at = now(), updated_by = auth.uid() where id = p_id;
end $$;

grant execute on function pedidos_cocina, marcar_item_pedido, insumos_cocina, ajustar_insumo, mi_rol to authenticated;

-- 5) Seguridad extra
-- 5a) Validar lo que entra: ids con formato seguro y registros de tamaño razonable
do $$
declare t text;
begin
  foreach t in array array['pedidos','presupuestos','gastos','clientes','recetas','insumos','stockpt','produccion','proveedores','movprov','empleados','horas','novedades','config'] loop
    execute format('alter table %I drop constraint if exists id_valido', t);
    execute format('alter table %I add constraint id_valido check (id ~ ''^[A-Za-z0-9_.:-]{1,100}$'')', t);
    execute format('alter table %I drop constraint if exists tamano_valido', t);
    execute format('alter table %I add constraint tamano_valido check (jsonb_typeof(data) = ''object'' and octet_length(data::text) < 500000)', t);
  end loop;
end $$;

-- 5b) Quién y cuándo lo pone la base, no el dispositivo (no se puede falsificar)
create or replace function sellar_cambio() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- 5c) Historial de cambios: cada alta, cambio o borrado queda guardado con quién lo hizo.
-- Nadie lo puede borrar ni modificar desde la app; las dueñas y administración lo pueden ver y restaurar.
create table if not exists auditoria (
  n bigserial primary key,
  cuando timestamptz not null default now(),
  usuario uuid default auth.uid(),
  tabla text not null,
  fila text not null,
  accion text not null,
  antes jsonb,
  despues jsonb
);
create index if not exists auditoria_tabla_fila on auditoria(tabla, fila);
create index if not exists auditoria_cuando on auditoria(cuando desc);
alter table auditoria enable row level security;
grant select on auditoria to authenticated;
grant select on auditoria to service_role;
drop policy if exists "todo ve el historial" on auditoria;
create policy "todo ve el historial" on auditoria for select using (mi_rol() = 'todo');

create or replace function registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare fila text;
begin
  if tg_op = 'DELETE' then
    fila := old.id::text;
    insert into auditoria(tabla, fila, accion, antes) values (tg_table_name, fila, 'borrado', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    fila := new.id::text;
    if to_jsonb(old) - 'updated_at' - 'updated_by' = to_jsonb(new) - 'updated_at' - 'updated_by' then return new; end if;
    insert into auditoria(tabla, fila, accion, antes, despues) values (tg_table_name, fila, 'cambio', to_jsonb(old), to_jsonb(new));
    return new;
  else
    fila := new.id::text;
    insert into auditoria(tabla, fila, accion, despues) values (tg_table_name, fila, 'alta', to_jsonb(new));
    return new;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['pedidos','presupuestos','gastos','clientes','recetas','insumos','stockpt','produccion','proveedores','movprov','empleados','horas','novedades','config'] loop
    execute format('drop trigger if exists sellar on %I', t);
    execute format('create trigger sellar before insert or update on %I for each row execute function sellar_cambio()', t);
    execute format('drop trigger if exists historial on %I', t);
    execute format('create trigger historial after insert or update or delete on %I for each row execute function registrar_cambio()', t);
  end loop;
  foreach t in array array['perfiles'] loop
    execute format('drop trigger if exists historial on %I', t);
    execute format('create trigger historial after insert or update or delete on %I for each row execute function registrar_cambio()', t);
  end loop;
end $$;
-- invitaciones usa el mail como id para el historial
create or replace function registrar_invitacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria(tabla, fila, accion, antes, despues)
  values ('invitaciones', coalesce(new.email, old.email), lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
drop trigger if exists historial on invitaciones;
create trigger historial after insert or update or delete on invitaciones for each row execute function registrar_invitacion();

-- 5d) Equipo: nadie puede quitarse a sí misma el acceso, y siempre queda al menos una persona con acceso a todo
create or replace function cuidar_perfiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if; -- cambios hechos desde el panel de Supabase
  if tg_op = 'UPDATE' and new.id <> old.id then raise exception 'No se puede cambiar el id'; end if;
  if tg_op in ('UPDATE','DELETE') and old.id = auth.uid() and (tg_op = 'DELETE' or new.rol <> old.rol) then
    raise exception 'No podés cambiar tu propio sector. Pedíselo a otra dueña.';
  end if;
  if tg_op in ('UPDATE','DELETE') and old.rol = 'todo' and (tg_op = 'DELETE' or new.rol <> 'todo')
     and (select count(*) from perfiles where rol = 'todo') <= 1 then
    raise exception 'Tiene que quedar al menos una persona con acceso a todo.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cuidar on perfiles;
create trigger cuidar before update or delete on perfiles for each row execute function cuidar_perfiles();

-- 5e) Las funciones solo las pueden usar usuarios con sesión iniciada (nunca visitantes anónimos)
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function pedidos_cocina, marcar_item_pedido, insumos_cocina, ajustar_insumo, mi_rol to authenticated;

-- 4c) Local: materia prima sin precios y actualización de precios desde facturas/remitos
-- Local: ve la lista de materia prima SIN precios (solo nombre, unidad, presentación y categoría)
create or replace function insumos_local() returns table(id text, data jsonb)
language sql stable security definer set search_path = public as $$
  select id, jsonb_strip_nulls(jsonb_build_object('nombre',data->'nombre','unidad',data->'unidad','presentacion',data->'presentacion','cat',data->'cat'))
  from insumos where mi_rol() in ('local','todo')
$$;

-- Al cargar una factura o remito, actualiza el precio de cada materia prima (nada más).
-- No pisa un precio más nuevo con uno de una factura más vieja.
create or replace function precios_desde_factura(p_items jsonb, p_proveedor text, p_fecha text) returns integer
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; pr numeric; f text := left(coalesce(p_fecha,''),10);
begin
  if mi_rol() not in ('local','todo') then raise exception 'sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'ítems inválidos'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin pr := (it->>'precio')::numeric; exception when others then pr := null; end;
    if pr is null or pr <= 0 or pr > 1000000000 then continue; end if;
    update insumos set data = data || jsonb_build_object('precioAnterior', data->'precio', 'precio', pr, 'precioFecha', f, 'proveedor', left(coalesce(p_proveedor,''),120))
      where id = it->>'id' and coalesce(data->>'precioFecha','') <= f and coalesce((data->>'precio')::numeric,-1) <> pr;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

grant execute on function insumos_local, precios_desde_factura to authenticated;
