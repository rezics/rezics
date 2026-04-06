import Grid from "@mui/material/Grid";
import MuiInput from "@mui/material/Input";
import Slider from "@mui/material/Slider";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type * as React from "react";

const Input = styled(MuiInput)`
  width: 42px;
`;

export function ChapterArboristHeightSlider({
  height,
  setHeight,
}: {
  height: number;
  setHeight: (height: number) => void;
}) {
  const maxHeight = 2000;
  const handleSliderChange = (_event: Event, newValue: number) => {
    setHeight(newValue);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHeight(event.target.value === "" ? 0 : Number(event.target.value));
  };

  const handleBlur = () => {
    if (height < 0) {
      setHeight(0);
    } else if (height > maxHeight) {
      setHeight(maxHeight);
    }
  };

  return (
    <div>
      <Grid container spacing={2} sx={{ alignItems: "center" }}>
        <Grid>
          <Typography id="input-slider" gutterBottom>
            Chapter Arborist Height
          </Typography>
        </Grid>
        <Grid size="grow">
          <Slider
            value={typeof height === "number" ? height : 0}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
            max={maxHeight}
          />
        </Grid>
        <Grid>
          <Input
            value={height}
            onChange={handleInputChange}
            onBlur={handleBlur}
            // inputProps={{
            //   step: 10,
            //   min: 0,
            //   max: maxHeight,
            //   type: 'number',
            //   'aria-labelledby': 'input-slider',
            // }}
          />
        </Grid>
      </Grid>
    </div>
  );
}
