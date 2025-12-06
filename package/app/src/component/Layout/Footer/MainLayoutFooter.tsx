import React from 'react';
import {
  Box,
  Container,
  Divider,
  Typography,
  Link as MUILink,
  IconButton,
  TextField,
  Button,
  Stack,
  Tooltip,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import TelegramIcon from '@mui/icons-material/Telegram';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

function SectionTitle({children}: {children: React.ReactNode}) {
  return (
    <Typography
      variant="subtitle1"
      fontWeight={700}
      color="text.primary"
      gutterBottom
    >
      {children}
    </Typography>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <MUILink
      href={href}
      underline="hover"
      color="text.secondary"
      sx={{lineHeight: 1.9, display: 'inline-block'}}
    >
      {children}
    </MUILink>
  );
}

export function MainLayoutFooter({className}: {className?: string}) {
  const year = new Date().getFullYear();

  return (
    <Box
      className={className}
      component="footer"
      sx={{bgcolor: 'background.paper', color: 'text.primary'}}
    >
      <Divider sx={{borderColor: 'divider'}} />

      <Container maxWidth="lg" className="mx-auto px-4">
        {/* Top content */}
        <Box className="py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand / Intro */}
            <div className="md:col-span-1">
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{letterSpacing: 0.2}}
              >
                Library.Book
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{mt: 1.5}}>
                一个全面的，包含数字时代作品的书库，期待着让人们找到他们所寻的书，让故事遇见正确的人。
                <br />
                inherited·create·spread
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                sx={{mt: 2}}
                aria-label="社交链接"
              >
                <Tooltip title="GitHub">
                  <IconButton
                    aria-label="GitHub"
                    color="primary"
                    size="small"
                    href="https://github.com/REZICS"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitHubIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Telegram">
                  <IconButton
                    aria-label="Telegram"
                    color="primary"
                    size="small"
                    href="https://t.me/REZICSofficial"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TelegramIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* <Tooltip title="暂无账号">
                  <IconButton
                    aria-label="Twitter"
                    color="primary"
                    size="small"
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitterIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="暂无账号">
                  <IconButton
                    aria-label="LinkedIn"
                    color="primary"
                    size="small"
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkedInIcon fontSize="small" />
                  </IconButton>
                </Tooltip> */}
              </Stack>
            </div>

            {/* Navigation */}
            <nav aria-label="产品" className="md:col-span-1">
              <SectionTitle>产品</SectionTitle>
              <Stack spacing={0.5}>
                <FooterLink href="/book">发现</FooterLink>
                <FooterLink href="/readlist">阅读单</FooterLink>
                <FooterLink href="/review">评论与评测</FooterLink>
                <FooterLink href="/unit">搜索</FooterLink>
              </Stack>
            </nav>

            <nav aria-label="资源" className="md:col-span-1">
              <SectionTitle>资源</SectionTitle>
              <Stack spacing={0.5}>
                <FooterLink href="/docs">文档</FooterLink>
                <FooterLink href="/api">API</FooterLink>
                <FooterLink href="/changelog">更新日志</FooterLink>
                <FooterLink href="/status">系统状态</FooterLink>
              </Stack>
            </nav>

            {/* Newsletter */}
            <div className="md:col-span-1">
              <SectionTitle>订阅更新</SectionTitle>
              <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                获取最新功能与精选书单推送。(开发中)
              </Typography>
              <Stack
                direction={{xs: 'column', sm: 'row'}}
                spacing={1}
                component="form"
                onSubmit={e => e.preventDefault()}
              >
                <TextField
                  size="small"
                  type="email"
                  placeholder="你的邮箱"
                  fullWidth
                  aria-label="邮箱"
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disableElevation
                  disabled
                >
                  订阅
                </Button>
              </Stack>
            </div>
          </div>
        </Box>

        <Divider sx={{borderColor: 'divider'}} />

        {/* Bottom bar */}
        <Box
          className="py-6"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            rowGap: 1.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {year} REZICS · 保留所有权利
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <MUILink
              href="/privacy"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              隐私
            </MUILink>
            <MUILink
              href="/terms"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              条款
            </MUILink>
            <MUILink
              href="/contact"
              color="text.secondary"
              underline="hover"
              variant="caption"
            >
              联系我们
            </MUILink>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
