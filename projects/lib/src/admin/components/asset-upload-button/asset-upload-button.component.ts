import {
  Component,
  OnInit,
  Input,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Asset, AssetUpload } from '@ordercloud/cms-sdk'

@Component({
  selector: 'cms-asset-upload-button',
  templateUrl: './asset-upload-button.component.html',
  styleUrls: ['./asset-upload-button.component.css'],
})
export class AssetUploadButtonComponent implements OnInit {
  @Input() multiple = false;
  @Input() beforeAssetUpload?: (asset: AssetUpload) => Promise<AssetUpload>;
  @ViewChild('confirmAssetUploadTemplate') confirmAssetUploadModal: ElementRef;
  @ViewChild('fileInput') fileInput: ElementRef;
  @Output() assetsUploaded = new EventEmitter<{
    uploaded: Asset[];
    errors: any[];
  }>();
  selectedFiles?: any; // FileList
  confirmModal: NgbModalRef;
  constructor(private modalService: NgbModal) {}

  ngOnInit(): void {}

  handleUploadClick() {
    this.selectedFiles = undefined;
    this.fileInput.nativeElement.click();
  }

  confirmAssetUpload(e) {
    this.selectedFiles = Array.from(e.target.files);
    this.confirmModal = this.modalService.open(this.confirmAssetUploadModal, {
      backdropClass: 'oc-tinymce-modal_backdrop',
      windowClass: 'oc-tinymce-modal_window'
    });
  }

  handleCancel() {
    this.confirmModal.dismiss('user dismissed modal');
    this.selectedFiles = undefined;
  }

  handleAssetsUploaded(event: any) {
    this.confirmModal.close();
    this.selectedFiles = undefined;
    this.assetsUploaded.emit(event);
  }
}
