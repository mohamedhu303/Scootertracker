import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * 🖼️ Image URL Pipe
 * بيحوّل أي relative path للصورة لـ full URL مع الـ baseUrl
 * 
 * الاستخدام:
 * <img [src]="photo.photoUrl | imageUrl" />
 */
@Pipe({
  name: 'imageUrl',
  standalone: true,
})
export class ImageUrlPipe implements PipeTransform {
  transform(url: string | null | undefined): string {
    if (!url) return '';

    // ✅ لو URL كامل بالفعل، ارجعه زي ما هو
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // ✅ لو relative path، ضيف الـ baseUrl
    const baseUrl = environment.apiBaseUrl.replace(/\/$/, ''); // شيل / من الآخر
    const path = url.startsWith('/') ? url : `/${url}`;       // ضيف / لو مش موجود

    return `${baseUrl}${path}`;
  }
}