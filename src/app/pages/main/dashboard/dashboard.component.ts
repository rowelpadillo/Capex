import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileUploadService, AppSheetRecord } from '../../../service/file-upload.service'; // Adjust path if needed
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // Import this instead of NgIf/NgFor

interface PreviewFile {
  file: File;
  name: string;
  size: number;
  type: string;
  preview: string | SafeResourceUrl | null;
  status?: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadError?: string; // To store error messages
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [
    CommonModule // <-- Use CommonModule for pipes like `toFixed`
  ]
})
export class DashboardComponent {
  files: PreviewFile[] = [];
  isDragOver: boolean = false;
  previewFileIndex: number | null = null;
  isUploading: boolean = false;

  constructor(
    private sanitizer: DomSanitizer,
    private fileUploadService: FileUploadService
  ) {}

  // --- Local File & UI Methods ---

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      this.addFilesToList(droppedFiles);
    }
  }

  onFileSelected(event: any) {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      this.addFilesToList(selectedFiles);
    }
    event.target.value = '';
  }

  private addFilesToList(fileList: FileList) {
    Array.from(fileList).forEach(file => {
      const previewFile: PreviewFile = {
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: null,
        status: 'pending' // Set initial status
      };

      if (this.isImage(file)) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          previewFile.preview = e.target.result;
          this.files.push(previewFile);
        };
        reader.readAsDataURL(file);
      } else if (this.isPDF(file)) {
        const objectUrl = URL.createObjectURL(file);
        previewFile.preview = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
        this.files.push(previewFile);
      } else {
        this.files.push(previewFile);
      }
    });
  }

  removeFile(index: number) {
    const file = this.files[index];
    if (this.isPDF(file.file) && file.preview) {
      const urlString = (file.preview as any).changingThisBreaksApplicationSecurity;
      if (urlString) {
        URL.revokeObjectURL(urlString);
      }
    }
    this.files.splice(index, 1);
  }

  clearFiles() {
    this.files.forEach(file => {
      if (this.isPDF(file.file) && file.preview) {
        const urlString = (file.preview as any).changingThisBreaksApplicationSecurity;
        if (urlString) {
          URL.revokeObjectURL(urlString);
        }
      }
    });
    this.files = [];
  }

  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  isPDF(file: File): boolean {
    return file.type === 'application/pdf';
  }

  viewFile(index: number) {
    this.previewFileIndex = index;
  }

  closePreview() {
    this.previewFileIndex = null;
  }

  getAnimationDelay(index: number): string {
    const delays = ['0.1s', '0.15s', '0.2s', '0.25s'];
    return index < delays.length ? delays[index] : '0.3s';
  }


  // --- Upload Workflow Methods ---

  private simulateUploadToStorage(file: File): Observable<string> {
    console.log(`Step 1 (Simulated): Uploading ${file.name} to cloud storage...`);
    const delay = 1000;
    
    return new Observable(observer => {
      setTimeout(() => {
        const publicUrl = `https://storage.example.com/files/${Date.now()}_${file.name}`;
        console.log(`Step 1 (Simulated): Success. Public URL is ${publicUrl}`);
        observer.next(publicUrl);
        observer.complete();
      }, delay);
    });
  }

  private addRecordToAppSheet(file: PreviewFile, publicUrl: string): Observable<any> {
    console.log(`Step 2: Adding ${file.name} record to AppSheet...`);
    const createdBy = 'currentUser'; // TODO: Replace with real user

    const newRecord: AppSheetRecord = {
      filename: file.name,
      url: publicUrl,
      type: file.type,
      createdby: createdBy
    };

    return this.fileUploadService.addFileRecord(newRecord);
  }

  uploadFiles() {
    if (this.files.length === 0 || this.isUploading) {
      return;
    }

    this.isUploading = true;

    const uploadObservables: Observable<any>[] = this.files
      .filter(file => file.status === 'pending' || file.status === 'failed')
      .map(previewFile => {
        previewFile.status = 'uploading';
        previewFile.uploadError = undefined;

        return this.simulateUploadToStorage(previewFile.file).pipe(
          switchMap(publicUrl => {
            return this.addRecordToAppSheet(previewFile, publicUrl);
          }),
          tap(() => {
            previewFile.status = 'uploaded';
            console.log(`Successfully uploaded and recorded: ${previewFile.name}`);
          }),
          catchError(error => {
            console.error(`Upload failed for: ${previewFile.name}`, error);
            previewFile.status = 'failed';
            previewFile.uploadError = error.message || 'Unknown error';
            return of(null);
          })
        );
      });

    if (uploadObservables.length === 0) {
      this.isUploading = false;
      return;
    }

    forkJoin(uploadObservables).subscribe({
      next: (results) => {
        this.isUploading = false;
        const successfulUploads = results.filter(r => r !== null).length;
        alert(`Successfully processed ${successfulUploads} / ${uploadObservables.length} file(s)!`);
        
        this.files = this.files.filter(f => f.status !== 'uploaded');
      },
      error: () => {
        this.isUploading = false;
        alert('An unexpected error occurred. Please try again.');
      }
    });
  }
}