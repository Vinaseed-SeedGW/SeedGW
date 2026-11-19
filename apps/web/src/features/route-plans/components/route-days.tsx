import { formatNumber } from '@seedgw/contracts/format';
import {
  countStops,
  mapsDirectionLinks,
  type RouteCompletion,
  type RouteDayView,
} from '@seedgw/contracts/route-plans';

export function CompletionText({ completion }: { completion: RouteCompletion | null }) {
  if (!completion || completion.planned === 0) {
    return <span className="text-text-muted">Chưa tới ngày đi tuyến</span>;
  }
  const percent = Math.round((completion.visited / completion.planned) * 100);
  return (
    <span>
      Đã ghé {formatNumber(completion.visited)} trên {formatNumber(completion.planned)} điểm tới hôm
      nay, đạt {formatNumber(percent)}%
    </span>
  );
}

/** Các ngày trong tuyến, điểm theo đúng thứ tự, nhãn Đã ghé lấy từ check-in của chủ tuyến. */
export function RouteDays({ days }: { days: readonly RouteDayView[] }) {
  if (countStops(days) === 0) return <p className="mt-2 text-text-muted">Chưa có điểm nào.</p>;
  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      {days.map((day) => {
        const links = mapsDirectionLinks(day.stops);
        return (
          <section
            key={day.day}
            aria-label={day.label}
            className="min-w-0 rounded-md border border-border p-3"
          >
            <h4 className="font-bold">
              {day.label}
              <span className="ml-2 text-sm font-normal text-text-muted">
                {day.stops.length > 0 ? `${day.stops.length} điểm` : 'Không đi tuyến'}
              </span>
            </h4>
            {day.stops.length > 0 ? (
              <ol className="mt-1 grid gap-1">
                {day.stops.map((stop, index) => (
                  <li key={stop.dealerId} className="flex gap-2">
                    <span className="w-6 flex-none text-right text-text-muted">{index + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-bold">{stop.dealerName}</span>
                      {stop.dealerCode ? (
                        <span className="text-sm text-text-muted"> ({stop.dealerCode})</span>
                      ) : null}
                      {stop.visited ? (
                        <span className="ml-1 rounded-sm bg-brand-soft px-1.5 text-sm text-brand">
                          Đã ghé
                        </span>
                      ) : null}
                      <span className="block text-sm text-text-muted">
                        {stop.address}
                        {stop.lat === null ? ', chưa có toạ độ' : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {links.length > 0 ? (
              <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
                {links.map((link) => (
                  <a
                    key={link.from}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    Xem đường đi
                    {links.length > 1 ? ` điểm ${link.from} đến ${link.to}` : ''} trên Google Maps
                  </a>
                ))}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
