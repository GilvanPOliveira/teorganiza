import type { ComponentType } from 'react'
import { Bot, FolderOpen, Newspaper } from 'lucide-react'
import { Badge, useT, type IconProps } from '@core/api'

function Preview({ id, icon: Icon }: { id: string; icon: ComponentType<IconProps> }) {
  const t = useT()
  return (
    <section className="to-preview">
      <span className="to-iconbox">
        <Icon size={20} />
      </span>
      <Badge tone="accent">{t('soon')}</Badge>
      <h2 className="to-tile__title">{t(`${id}.title`)}</h2>
      <p>{t(`${id}.what`)}</p>
      <p>{t(`${id}.why`)}</p>
    </section>
  )
}

export const NewsPreview = () => <Preview id="news" icon={Newspaper} />
export const FilesPreview = () => <Preview id="files" icon={FolderOpen} />
export const NexPreview = () => <Preview id="nex" icon={Bot} />
