import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Camera, ImagePlus, Trash2, X, Plus, Sparkles, ZoomIn, Calendar, Upload } from 'lucide-react';
import type { GalleryPhoto, UserRole } from '@/types';
import { fetchGalleryPhotos, uploadGalleryPhoto, deleteGalleryPhoto } from '@/lib/gallery';
import { useLockScroll } from '@/components/SmoothScroll';

interface GalleryProps {
  onBack: () => void;
  onBook?: () => void;
  userRole?: UserRole | null;
  userEmail?: string | null;
}

export function Gallery({ onBack, onBook, userRole, userEmail }: GalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  useLockScroll(Boolean(activePhoto || showUploadModal));
  const [uploading, setUploading] = useState(false);
  const [photoTitle, setPhotoTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isStaff =
    Boolean(userRole?.role && userRole?.status === 'verified') ||
    (userEmail &&
      ['franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com'].includes(
        userEmail.toLowerCase().trim()
      ));

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const data = await fetchGalleryPhotos();
    setPhotos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setShowUploadModal(true);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);

    const { photo, error } = await uploadGalleryPhoto(selectedFile, photoTitle, userRole?.barber_id);
    if (error) {
      setUploadError(error);
      setUploading(false);
      return;
    }

    if (photo) {
      setPhotos((prev) => [photo, ...prev.filter((p) => p.id !== photo.id)]);
    }

    setUploading(false);
    setShowUploadModal(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setPhotoTitle('');
  };

  const handleDelete = async (id: string, imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta fotografía de la galería?')) return;
    const { error } = await deleteGalleryPhoto(id, imageUrl);
    if (error) {
      alert('No se pudo eliminar: ' + error);
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (activePhoto?.id === id) setActivePhoto(null);
  };

  return (
    <div className="relative min-h-screen pb-24 animate-fade-in text-zinc-200">
      {/* Top Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/70 px-4 py-3.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 transition-all hover:border-gold/30 hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="text-center">
            <h1 className="font-display text-base font-bold text-white tracking-wide">Cortes & Estilos</h1>
            <p className="text-[0.65rem] uppercase tracking-widest text-gold font-semibold">Galería Adrián Millán</p>
          </div>

          {onBook ? (
            <button
              onClick={onBook}
              className="inline-flex items-center gap-1.5 rounded-full gold-gradient px-4 py-2 text-xs font-bold text-black uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reservar</span>
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {/* Staff Quick Action Bar */}
        {isStaff && (
          <div className="mb-8 rounded-3xl border border-gold/30 bg-zinc-900/80 p-4 shadow-xl backdrop-blur-xl animate-scale-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient text-black">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Modo Personal / Barbero</p>
                  <p className="text-[0.7rem] text-zinc-400">Sube fotos directamente desde la cámara o la galería de tu móvil</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Camera Trigger */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2.5 text-xs font-bold text-gold transition-all hover:bg-gold/20 active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  Cámara
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Gallery File Trigger */}
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full gold-gradient px-4 py-2.5 text-xs font-bold text-black uppercase tracking-wider transition-all hover:brightness-110 active:scale-95 shadow-md"
                >
                  <ImagePlus className="h-4 w-4" />
                  Subir foto
                </button>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-12 text-center">
            <Camera className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
            <p className="font-display text-base font-bold text-white">Aún no hay fotos en la galería</p>
            <p className="mt-1 text-xs text-zinc-400">Pronto publicaremos los mejores cortes y trabajos de la barbería.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setActivePhoto(p)}
                className="group relative break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-lg transition-all duration-300 hover:border-gold/30 hover:shadow-gold/10 hover:-translate-y-1 cursor-pointer"
              >
                <img
                  src={p.image_url}
                  alt={p.title || 'Corte de pelo'}
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                  <div className="flex justify-between items-center">
                    <span className="rounded-full bg-black/60 p-1.5 text-white/80 backdrop-blur-md">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </span>

                    {/* Staff delete button */}
                    {isStaff && (
                      <button
                        onClick={(e) => handleDelete(p.id, p.image_url, e)}
                        title="Eliminar fotografía"
                        className="rounded-full bg-red-500/80 p-1.5 text-white hover:bg-red-600 active:scale-90 transition-all shadow-md"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {p.title && (
                    <div>
                      <p className="text-xs font-bold text-white truncate drop-shadow">{p.title}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox / Fullscreen Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg animate-fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div
            data-lenis-prevent
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 p-2 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <img
              src={activePhoto.image_url}
              alt={activePhoto.title || 'Corte ampliado'}
              className="max-h-[75vh] w-full rounded-2xl object-contain"
            />

            <div className="flex items-center justify-between px-3 py-3">
              <div>
                <p className="text-sm font-bold text-white">{activePhoto.title || 'Corte en Barbería Adrián Millán'}</p>
                <p className="text-xs text-zinc-500">Calle Artesanos 6, Huelva</p>
              </div>

              {onBook && (
                <button
                  onClick={() => {
                    setActivePhoto(null);
                    onBook();
                  }}
                  className="rounded-full gold-gradient px-4 py-2 text-xs font-bold text-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
                >
                  Pedir este corte
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Upload Confirmation Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            data-lenis-prevent
            className="w-full max-w-sm rounded-3xl border border-gold/30 bg-zinc-950 p-6 shadow-2xl animate-scale-in text-left text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-gold" />
                <h3 className="font-display text-sm font-bold text-white">Publicar nuevo corte</h3>
              </div>
              {!uploading && (
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {previewUrl && (
              <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 max-h-56 bg-zinc-900">
                <img src={previewUrl} alt="Vista previa" className="w-full h-56 object-cover" />
              </div>
            )}

            <form onSubmit={handleConfirmUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Título o estilo <span className="text-zinc-600 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="Ej: Skin fade con degradado"
                  className="w-full rounded-xl glass-card px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                  {uploadError}
                </p>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 rounded-full gold-gradient py-3 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                    Subiendo foto...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Publicar en la galería
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
