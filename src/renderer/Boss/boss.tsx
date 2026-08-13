import { CssBaseline, Box } from "@mui/material";
import { BosonHeader } from "renderer/Components";
import BOSSStatus from "./components/BOSSStatus";

export default function Boss() {
    return (
        <Box
        component='main'
        display='flex'
        position='absolute'
        width='100%'
        top={0}>
        <CssBaseline />
        <BosonHeader/>
        <BOSSStatus />
        </Box>
    )
}