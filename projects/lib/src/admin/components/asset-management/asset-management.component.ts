import {
  Component,
  OnInit,
  Input,
  SimpleChanges,
  OnChanges,
  Output,
  EventEmitter,
  TemplateRef,
} from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  Asset,
  Meta,
  ListArgs,
  ContentManagementClient,
  ListPage,
  AssetUpload,
} from '@ordercloud/cms-sdk'
import { ResourceType } from '../../../shared/models/resource-type.interface';
import { AssetListMode } from '../asset-list/asset-list.component';
import DEFAULT_ASSET_TYPES, {
  ASSET_TYPES,
} from '../../constants/asset-types.constants';
import { CmsAssetFilterSelections } from '../asset-filters/asset-filters.component';

@Component({
  selector: 'cms-asset-management',
  templateUrl: './asset-management.component.html',
  styleUrls: ['./asset-management.component.scss'],
})
export class AssetManagementComponent implements OnInit, OnChanges {
  @Input() defaultListOptions?: Partial<ListArgs> = {};
  @Input() resourceType?: ResourceType;
  @Input() resourceID?: string;
  @Input() selectable = false;
  @Input() multiple = false;
  @Input() selectedAsset: Asset[] = [];
  @Input() showAssetStatus = true;
  @Input() additionalFilters?: TemplateRef<any>;
  @Input() downloadableFileTypes?: string[] = [];
  @Input('assetTypes') assetTypesOverride?: ASSET_TYPES[];
  @Input('tagOptions') tagOptionsOverride?: string[];
  @Input() beforeAssetUpload?: (asset: AssetUpload) => Promise<AssetUpload>;
  @Input() showListModeToggle = true;
  @Input() listMode: AssetListMode = 'table';
  @Output() selectedAssetChange = new EventEmitter<Asset[]>();

  assetTypes: ASSET_TYPES[] = DEFAULT_ASSET_TYPES;
  tagOptions: string[] = [];
  assetDetail?: Asset;
  options: Partial<ListArgs> = {};
  filterSelections: CmsAssetFilterSelections;
  search = '';
  searchDebounce: any;
  items?: Asset[] = [];
  meta?: Meta;
  currentRequestOptions?: ListArgs<Asset>;

  constructor(
    private spinner: NgxSpinnerService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    if (this.assetTypesOverride) {
      this.assetTypes = this.assetTypesOverride;
    }
    if (this.tagOptionsOverride) {
      this.tagOptions = this.tagOptionsOverride;
    }
    if (this.resourceID && this.resourceType && this.defaultListOptions) {
      console.warn(
        "Because you've provided a resourceType and resourceID, defaultListOptions will be ignored as they are not currently supported while listing assets per resource"
      );
    }
    this.listAssets();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Called before any other lifecycle hook. Use it to inject dependencies, but avoid any serious work here.
    // Add '${implements OnChanges}' to the class.
    if (changes.assetTypesOverride && !changes.assetTypesOverride.firstChange) {
      this.assetTypes = this.assetTypesOverride
        ? this.assetTypesOverride
        : DEFAULT_ASSET_TYPES;
    }
    if (changes.tagOptionsOverride && !changes.tagOptionsOverride.firstChange) {
      this.tagOptions = this.tagOptionsOverride ? this.tagOptionsOverride : [];
    }
    if (
      (changes.defaultListOptions && !changes.defaultListOptions.firstChange) ||
      (changes.resourceID && !changes.resourceID.firstChange) ||
      (changes.resourceType && !changes.resourceType.firstChange)
    ) {
      this.options.page = 1;
      this.ngOnInit();
    }
  }

  listAssets() {
    this.spinner.show();
    const requestOptions: ListArgs<Asset> = Object.assign(
      { pageSize: 24 }, // use 24 because this fits most grid cases
      {
        ...this.options,
        ...this.defaultListOptions,
        filters: {
          ...this.options.filters,
          ...this.defaultListOptions.filters,
        },
      }
    );

    if (this.assetTypes.length === 1) {
      requestOptions.filters.Type = this.assetTypes[0];
    } else if (!(requestOptions.filters && requestOptions.filters.Type)) {
      requestOptions.filters.Type = this.assetTypes.join('|');
    }

    this.currentRequestOptions = requestOptions;

    return (this.resourceID && this.resourceType
      ? this.listAssetsByResource(requestOptions)
      : this.listAssetsByFilters(requestOptions)
    ).finally(() => {
      this.spinner.hide();
    });
  }

  listAssetsByResource(options: ListArgs<Asset>) {
    // only page and pageSize are accepted parameters
    return ContentManagementClient.Assets.ListAssets(
      this.resourceType,
      this.resourceID,
      options
    ).then((response: any) => {
      if (options === this.currentRequestOptions) {
        this.items = response;
      }
    });
  }

  listAssetsByFilters(options: ListArgs<Asset>) {
    return ContentManagementClient.Assets.List(options).then(
      (response: ListPage<Asset>) => {
        if (options === this.currentRequestOptions) {
          this.items = response.Items;
          this.meta = response.Meta;
        }
      }
    );
  }

  handleAssetClick(asset: Asset) {
    this.assetDetail = asset;
  }

  handleselectedAssetChange(assets: Asset[]) {
    this.selectedAssetChange.emit(assets);
  }

  handleAssetsUploaded(event: { uploaded: Asset[]; errors: [] }) {
    this.items = [...this.items, ...event.uploaded];
    if (event.uploaded.length === 1 && !this.selectable) {
      this.assetDetail = event.uploaded[0];
    }
    this.selectedAssetChange.emit(event.uploaded);
    if (event.errors && event.errors.length) {
      // TODO: how should we handle upload errors?
    }
  }

  handleAssetDeleted(asset: Asset) {
    this.items = this.items.filter((i) => i.ID !== asset.ID);
    this.assetDetail = undefined;
  }

  handleAssetSaved(asset: Asset) {
    const selectedIndex = this.items.findIndex((i) => i.ID === asset.ID);
    if (selectedIndex < 0) {
      return;
    }
    this.items[selectedIndex] = asset;
    this.assetDetail = asset;
  }

  handleSearchChange(value: string) {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.search = value;
    this.options = {
      ...this.options,
      page: 1,
      filters: {
        ...this.options.filters,
        Title: `*${value}*`,
      },
    };
    this.searchDebounce = setTimeout(() => {
      this.listAssets();
    }, 300);
  }

  handleFilterChange(selections: CmsAssetFilterSelections) {
    this.options.page = 1;
    this.options.filters = {
      ...this.options.filters,
      Type: this.assetTypes.filter((k) => selections.types[k]).join('|'),
      Tags: this.tagOptions.filter((k) => selections.tags[k]).join('|'),
    };
    this.listAssets();
  }

  handlePageChange(page: number) {
    this.options.page = page;
    this.listAssets();
  }

  get tagSelections(): any {
    const result = {};
    if (this.options && this.options.filters && this.options.filters.Tags) {
      this.tagOptions.forEach((t) => {
        result[t] = this.options.filters.Tags.includes(t);
      });
    }
    return result;
  }

  get typeSelections(): any {
    const result = {};
    if (this.options && this.options.filters && this.options.filters.Type) {
      this.assetTypes.forEach((t) => {
        result[t] = this.options.filters.Type.includes(t);
      });
    }
    return result;
  }
}
