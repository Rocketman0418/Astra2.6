/*
  # Create storage bucket for chat media

  1. Storage
    - Create 'chat-media' bucket for storing team chat images
    - Set up RLS policies for authenticated users
    - Allow public read access for images

  2. Security
    - Only authenticated users can upload
    - Public read access for viewing images
    - File size and type restrictions handled on client side
*/

-- Create the storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Allow authenticated users to view their own uploads
CREATE POLICY "Authenticated users can view chat media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');

-- Allow public read access to chat media (for viewing images in chat)
CREATE POLICY "Public read access to chat media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete their own chat media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND owner = auth.uid());