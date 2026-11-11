import { AlertCircle, Check, CheckCircle, Clock, Loader2, Lock, ShoppingBag, Trash2, Upload, XCircle } from 'lucide-react'
import AvatarWithFrame from '../../ui/AvatarWithFrame'
import { assetUrl } from '../../../hooks/useBranding'
import { fmt } from '../profileUtils'
import Sheet from './Sheet'

const isHttp = (v) => typeof v === 'string' && v.startsWith('http')
const block = (e) => e.preventDefault()

const Group = ({ icon, title, action, children }) => (
  <section className="mt-5 first:mt-1">
    <div className="mb-3 flex min-h-[36px] items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
      <h3 className="min-w-0 flex-1 truncate text-sm font-black text-slate-700">{title}</h3>
      {action}
    </div>
    {children}
  </section>
)

const GRID = 'grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6'

// One round avatar to pick. `locked` avatars and uploads that are not approved cannot be chosen.
const Face = ({ url, name, label, selected, dimmed, onClick, title, ring = '', children, caption }) => (
  <div className="flex min-w-0 flex-col items-center text-center">
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={title || name}
        title={title}
        className={`pf-press relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-slate-100 text-3xl leading-none outline-none ring-offset-2 transition focus-visible:ring-4 focus-visible:ring-sky-300 ${
          selected ? 'ring-4 ring-sky-500' : ring || 'ring-2 ring-slate-200 hover:ring-sky-300'
        } ${dimmed ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isHttp(url) ? (
          <img
            src={url}
            alt={name}
            draggable={false}
            loading="lazy"
            decoding="async"
            onContextMenu={block}
            className={`pointer-events-none h-full w-full select-none rounded-full object-cover ${dimmed ? 'opacity-60' : ''}`}
          />
        ) : (
          <span className={dimmed ? 'opacity-50' : ''}>{url}</span>
        )}
        {children}
      </button>
      {selected && (
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white">
          <Check className="h-3.5 w-3.5" strokeWidth={4} />
        </span>
      )}
    </div>
    <div className="mt-1.5 w-full truncate px-0.5 text-[11px] font-extrabold text-slate-700">{label || name}</div>
    {caption}
  </div>
)

const STATUS = {
  approved: { word: 'Đã duyệt', text: 'text-emerald-600', dot: 'bg-emerald-500', ring: 'ring-2 ring-emerald-300 hover:ring-sky-300', icon: CheckCircle },
  pending: { word: 'Chờ duyệt', text: 'text-amber-600', dot: 'bg-amber-500', ring: 'ring-2 ring-amber-300', icon: AlertCircle },
  rejected: { word: 'Từ chối', text: 'text-rose-500', dot: 'bg-rose-500', ring: 'ring-2 ring-rose-300', icon: XCircle },
}

/**
 * Choose an avatar: the ones unlocked by XP, the ones bought in the shop, and the student's own uploads (which an
 * admin approves first). Every rule is the page's; this only draws them.
 */
const AvatarPicker = ({
  onClose,
  selectedAvatar,
  frameUrl,
  frameRatio,
  fallback,
  totalXP,
  levelText,
  avatars,
  onPickAvatar,
  purchased,
  onPickPurchased,
  uploads,
  onPickUpload,
  onDeleteUpload,
  onUpload,
  uploading,
  cooldownDays,
}) => {
  const uploadBlocked = uploading || uploads.length >= 20 || cooldownDays > 0
  const uploadText = uploading ? 'Đang tải...' : uploads.length >= 20 ? 'Tối đa 20 avatar' : cooldownDays > 0 ? `Chờ ${cooldownDays} ngày` : 'Tải ảnh lên'

  return (
    <Sheet
      title="Chọn Avatar"
      sub={levelText}
      size="lg"
      onClose={onClose}
      lead={<AvatarWithFrame avatarUrl={selectedAvatar} frameUrl={frameUrl} frameRatio={frameRatio} size={52} fallback={fallback} className="pf-picker-preview" />}
      count={
        <span className="inline-flex items-center gap-1" title={`XP hiện tại: ${totalXP}`} aria-label={`XP hiện tại: ${totalXP}`}>
          <img src={assetUrl('/icon/profile/XP.svg')} alt="" className="h-4 w-4" />
          {fmt(totalXP)}
        </span>
      }
    >
      <Group icon={<img src={assetUrl('/icon/profile/XP.svg')} alt="" className="h-4 w-4" />} title="Thu thập XP để mở khóa">
        <div className={GRID} data-group="xp">
          {avatars.map((avatar) => {
            const isUnlocked = totalXP >= avatar.unlock_xp
            const isSelected = selectedAvatar === avatar.image_url
            return (
              <Face
                key={avatar.id}
                url={avatar.image_url}
                name={avatar.name}
                selected={isUnlocked && isSelected}
                dimmed={!isUnlocked}
                onClick={() => isUnlocked && onPickAvatar(avatar)}
                title={isUnlocked ? `${avatar.name} - ${avatar.description}` : `${avatar.name} - Cần ${avatar.unlock_xp} XP để mở khóa`}
                caption={
                  !isUnlocked && (
                    <div className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 text-[10px] font-black leading-4 tabular-nums text-rose-500">
                      {fmt(avatar.unlock_xp)} XP
                    </div>
                  )
                }
              >
                {!isUnlocked && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/55 text-white">
                    <Lock className="h-5 w-5" />
                  </span>
                )}
              </Face>
            )
          })}
        </div>
      </Group>

      {purchased.length > 0 && (
        <Group icon={<ShoppingBag className="h-4 w-4" />} title="Avatar đã mua">
          <div className={GRID} data-group="shop">
            {purchased.map((item) => {
              const avatarUrl = item.item_data?.avatar_url || item.image_url
              return <Face key={`shop-${item.id}`} url={avatarUrl} name={item.name} selected={selectedAvatar === avatarUrl} onClick={() => onPickPurchased(item)} />
            })}
          </div>
        </Group>
      )}

      <Group
        icon={<Upload className="h-4 w-4" />}
        title="Avatar tự tải lên"
        action={
          <label
            data-upload
            className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-black transition focus-within:ring-4 focus-within:ring-sky-300 ${
              uploadBlocked
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'pf-press cursor-pointer bg-gradient-to-b from-sky-400 to-blue-600 text-white shadow-md shadow-blue-600/30 hover:from-sky-500'
            }`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : cooldownDays > 0 && uploads.length < 20 ? <Clock className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {uploadText}
            {/* Kept reachable with Tab (not display:none): Enter or Space opens the file chooser. */}
            <input type="file" accept="image/*" onChange={onUpload} disabled={uploadBlocked} className="sr-only" />
          </label>
        }
      >
        {uploads.length > 0 ? (
          <div className={GRID} data-group="uploads">
            {uploads.map((upload) => {
              const s = STATUS[upload.status] || STATUS.rejected
              const isApproved = upload.status === 'approved'
              const isPending = upload.status === 'pending'
              const Icon = s.icon
              return (
                <div key={`custom-${upload.id}`} className="relative min-w-0" data-upload-status={upload.status}>
                  <Face
                    url={upload.image_url}
                    name="Custom avatar"
                    label={<span className={s.text}>{s.word}</span>}
                    selected={isApproved && selectedAvatar === upload.image_url}
                    dimmed={!isApproved}
                    ring={s.ring}
                    onClick={() => isApproved && onPickUpload(upload)}
                    title={isApproved ? 'Nhấn để chọn' : isPending ? 'Đang chờ admin duyệt' : `Bị từ chối${upload.reject_reason ? ': ' + upload.reject_reason : ''}`}
                    caption={!isApproved && !isPending && upload.reject_reason ? <div className="line-clamp-2 w-full px-0.5 text-[10px] font-semibold leading-3 text-slate-400">{upload.reject_reason}</div> : null}
                  />
                  <span className={`pointer-events-none absolute left-1/2 top-0 ml-[18px] flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white ${s.dot}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {!isApproved && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteUpload(upload.id)
                      }}
                      title="Xóa"
                      aria-label="Xóa"
                      className="pf-press absolute left-1/2 top-[46px] ml-[16px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-white ring-2 ring-white hover:bg-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-400">
            Tải ảnh lên để sử dụng làm avatar. Ảnh sẽ cần được admin duyệt trước khi sử dụng.
          </p>
        )}
      </Group>
    </Sheet>
  )
}

export default AvatarPicker
