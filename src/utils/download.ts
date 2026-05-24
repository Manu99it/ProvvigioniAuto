import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const triggerDownload = async (blob: Blob, filename: string) => {
  const userAgent = navigator.userAgent || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile && Capacitor.isNativePlatform()) {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: filename,
        text: `Esportazione ${filename}`,
        url: savedFile.uri,
      });
      return;
    } catch (error) {
      console.error('Native sharing failed:', error);
    }
  }

  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `Esportazione ${filename}`
        });
        return;
      }
    } catch (error) {
      console.warn('Web Share API failed:', error);
    }
  }

  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    link.setAttribute('target', '_blank');

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error('Fallback download failed:', err);
  }
};
