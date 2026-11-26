import { useState } from 'react'
import { Search } from 'lucide-react'
import { EmptyState, FileDrop, FileRows, formatSize, useFiles, useT } from '@core/api'

export function FilesScreen() {
  const t = useT()
  const files = useFiles()
  const [query, setQuery] = useState('')
  const words = query.trim().toLocaleLowerCase()
  const shown = words ? files.filter((file) => file.data.name.toLocaleLowerCase().includes(words)) : files
  const total = files.reduce((sum, file) => sum + file.data.size, 0)

  return (
    <div className="to-stack">
      <FileDrop attachedTo={null} />
      {files.length > 5 && (
        <label className="to-search to-search--wide">
          <Search size={15} aria-hidden />
          <input className="to-search__input" value={query} placeholder="Buscar arquivo" aria-label="Buscar arquivo" onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      {files.length === 0 ? (
        <EmptyState title="Nenhum arquivo ainda" body={t('empty.body')} />
      ) : (
        <>
          <p className="to-muted">
            {files.length} {files.length === 1 ? 'arquivo' : 'arquivos'} · {formatSize(total)}
          </p>
          <FileRows files={shown} showOrigin />
        </>
      )}
    </div>
  )
}
