-- Gemini's diagram drawings and formatted pages are SVG (10 Nov 2026): allow SVG in the uploads bucket.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf', 'image/svg+xml']
 where id = 'uploads';
