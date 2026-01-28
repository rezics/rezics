import { Alert } from '@mui/material';
import { TextField, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { echoKvGetQuery } from '@package/api/echokv/echokv';
import { useQuery } from '@tanstack/react-query';

export function NewBookByUrl() {
  const [url, setUrl] = useState('');
  function handleCreateBook() {
    // TODO 对接爬虫
    console.log('create book', url);
  }
  const supportedSitesQuery = useQuery(
    echoKvGetQuery('crawler.supportedSites'),
  );
  const [supportedSitesList, setSupportedSitesList] = useState<
    { name: string; url: string }[]
  >([]);
  useEffect(() => {
    if (
      supportedSitesQuery.data?.value &&
      Array.isArray(supportedSitesQuery.data.value)
    ) {
      setSupportedSitesList(supportedSitesQuery.data.value);
    }
  }, [supportedSitesQuery]);
  return (
    <div className="mt-10 mx-auto w-11/12">
      <div className="text-2xl font-bold mb-4">通过URL创建书籍</div>
      <Alert severity="info">
        请输入书籍的URL，系统将自动获取书籍的元数据，并创建书籍。
      </Alert>
      <div className="mt-4">
        <div>支持的网站：</div>
        <ul>
          {supportedSitesList.map(site => (
            <li key={site.name}>
              <a href={site.url} target="_blank" rel="noreferrer">
                {site.name}: {site.url}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8">
        <div className="flex mb-4">
          <TextField
            fullWidth
            label="书籍URL"
            value={url}
            onChange={newValue => setUrl(newValue.target.value)}
            className="flex-1"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateBook}
            className="!ml-4"
          >
            创建
          </Button>
        </div>
      </div>
    </div>
  );
}
