-- PostgreSQL limita cada cuantificador a 255; conserva Place IDs de 5 a 256 caracteres.
create or replace function public.valid_nfc_destination(kind text, value text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select char_length(value) <= 2048
 and value !~ '[[:space:][:cntrl:]]'
 and value ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+([A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})(/|\?|#|$)'
 and value !~* '^https://([^/]+\.)?(localhost|local|internal|test|invalid)(/|\?|#|$)'
 and value !~* '^https://toca-one\.vercel\.app(/|\?|#|$)'
 and case kind
 when 'instagram' then (value ~ '^https://www\.instagram\.com/[a-z0-9_][a-z0-9_.]{0,28}[a-z0-9_]/$' or value ~ '^https://www\.instagram\.com/[a-z0-9_]/$') and value !~ '\.\.'
 when 'whatsapp' then value ~ '^https://wa\.me/[1-9][0-9]{7,14}$'
 when 'google_review' then value ~ '^https://g\.page/(r/)?[A-Za-z0-9_-]+/review/?(\?[^#]*)?$' or value ~ '^https://search\.google\.com/local/writereview\?([^#]*&)?placeid=[A-Za-z0-9_-]{4,255}[A-Za-z0-9_-](&[^#]*)?$'
 when 'generic' then true else false end;
$$;
