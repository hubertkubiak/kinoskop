import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '@kinoskop/shared';

@Component({
  selector: 'ks-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './site-footer.html',
})
export class SiteFooter {
  readonly brand = BRAND;
}
