
ALTER TABLE public.compliance_pages
ADD CONSTRAINT compliance_pages_user_id_page_type_key UNIQUE (user_id, page_type);
