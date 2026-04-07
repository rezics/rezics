import { InfoOutlined } from "@mui/icons-material";
import {
  Autocomplete,
  Avatar,
  Chip,
  CircularProgress,
  TextField as MuiTextField,
} from "@mui/material";
import { meiliUserApi } from "@rezics/api/meili/meili.api";
import type { BookDTO, UserDTO } from "@rezics/contract";
import { Checkbox } from "@rezics/ui/shadcn/checkbox.tsx";
import { Label } from "@rezics/ui/shadcn/label.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn/tooltip.tsx";
import React from "react";
import { useTranslation } from "react-i18next";

type PublicUserLike = Partial<UserDTO>;

export type BookMetadataValue = Partial<BookDTO>;

interface BookMetadataEditorProps {
  value?: BookMetadataValue;
  onChange?: (value: BookMetadataValue) => void;
  disabled?: boolean;
}

type UserOption = PublicUserLike;

const useUserSearch = () => {
  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<UserOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (input.trim() === "") {
      setOptions([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { users } = await meiliUserApi.userSearch({
          q: input,
          limit: 10,
        });
        if (active) setOptions(users as UserOption[]);
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [input]);

  return { input, setInput, options, loading };
};

const UsersMultiSelect: React.FC<{
  label: string;
  value: UserOption[];
  onChange: (v: UserOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, disabled }) => {
  const { input, setInput, options, loading } = useUserSearch();
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={options}
        value={value}
        onChange={(_, newValue) => onChange(newValue)}
        inputValue={input}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={(o) => o.name ?? ""}
        isOptionEqualToValue={(o, v) => o.unitId === v.unitId}
        filterOptions={(x) => x}
        loading={loading}
        size="small"
        renderInput={(params) => (
          <MuiTextField
            {...params}
            placeholder={placeholder}
            disabled={disabled}
            size="small"
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.unitId}>
            <div className="flex items-center gap-2">
              <Avatar src={option.avatar} sx={{ width: 24, height: 24 }}>
                {option.name?.[0] ?? "?"}
              </Avatar>
              <span>{option.name}</span>
            </div>
          </li>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.unitId}
              avatar={<Avatar src={option.avatar}>{option.name?.[0]}</Avatar>}
              label={option.name}
              size="small"
            />
          ))
        }
        disabled={disabled}
      />
    </div>
  );
};

function FlagWithTooltip({
  label,
  tooltip,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
        <Label className="text-sm cursor-pointer">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoOutlined
              sx={{ fontSize: 16 }}
              className="text-muted-foreground cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[280px]">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div className="space-y-1">
        <Label htmlFor="book-title">{t("book.fields.title")}</Label>
        <input
          id="book-title"
          value={value?.title ?? ""}
          onChange={(e) => onChange?.({ title: e.target.value })}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      {/* ISBN + Cover URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="book-isbn">{t("book.fields.isbn")}</Label>
          <input
            id="book-isbn"
            value={value?.isbn ?? ""}
            onChange={(e) => onChange?.({ isbn: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="book-cover">{t("book.fields.cover_url")}</Label>
          <input
            id="book-cover"
            value={value?.coverUrl ?? ""}
            onChange={(e) => onChange?.({ coverUrl: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Contributors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UsersMultiSelect
          label={t("book.fields.author")}
          value={(value?.author as any) ?? []}
          onChange={(v) => onChange?.({ author: v as any })}
          placeholder={t("book.placeholders.search_author")}
          disabled={disabled}
        />
        <UsersMultiSelect
          label={t("book.fields.press")}
          value={(value?.press as any) ?? []}
          onChange={(v) => onChange?.({ press: v as any })}
          placeholder={t("book.placeholders.search_press")}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UsersMultiSelect
          label={t("book.fields.producer")}
          value={(value?.producer as any) ?? []}
          onChange={(v) => onChange?.({ producer: v as any })}
          placeholder={t("book.placeholders.search_producer")}
          disabled={disabled}
        />
        <div className="space-y-1">
          <Label htmlFor="book-textlength">{t("book.fields.text_length")}</Label>
          <input
            id="book-textlength"
            type="number"
            value={value?.textLength ?? ""}
            onChange={(e) => onChange?.({ textLength: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-6">
        <FlagWithTooltip
          label={t("book.flags.licensed")}
          tooltip={t("book.tooltips.licensed")}
          checked={value?.isLicensed ?? false}
          onCheckedChange={(checked) => onChange?.({ isLicensed: !!checked })}
          disabled={disabled}
        />
        <FlagWithTooltip
          label={t("book.flags.nsfw")}
          tooltip={t("book.tooltips.nsfw")}
          checked={value?.nsfw ?? false}
          onCheckedChange={(checked) => onChange?.({ nsfw: !!checked })}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

/**
 * Standalone flag info components — used by search and other features.
 * Kept as named exports for backward compatibility.
 */
export function NSFWInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <span>{t("book.flags.nsfw")}</span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoOutlined
              sx={{ fontSize: 16 }}
              className="text-muted-foreground cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[280px]">{tooltipTitle ?? t("book.tooltips.nsfw")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function IsLicensedInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{t("book.flags.licensed")}</span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoOutlined
              sx={{ fontSize: 16 }}
              className="text-muted-foreground cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[280px]">{tooltipTitle ?? t("book.tooltips.licensed")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default BookMetadataEditor;
