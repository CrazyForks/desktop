import { useEffect, useState } from "react";
import { QueryResult } from "./database";
import ResultTable from "./ResultTable";
import { GridColumn } from "@glideapps/glide-data-grid";
import { Card, CardBody, CardHeader, Chip, Tooltip, Button, Divider } from "@heroui/react";
import { CheckCircle, CircleXIcon, Clock, HardDriveIcon, Rows4Icon } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface SQLProps {
  error: any;
  results: QueryResult | null;
  colorMode: "dark" | "light";
  dismiss?: () => void;
}

const SQLResults = ({ results, error, dismiss, colorMode }: SQLProps) => {
  const [columns, setColumns] = useState<GridColumn[] | null>(null);

  useEffect(() => {
    if (!results) return;
    if (!results.columns) return;

    let cols = results.columns.map((key: any) => {
      return {
        id: key.name,
        title: key.name,
        grow: 1,
      };
    });

    setColumns(cols as GridColumn[]);
  }, [results]);

  if (error) {
    return (
      <Card shadow="sm" className="w-full max-w-full border border-danger-200">
        <CardHeader className="flex justify-between items-center bg-danger-50">
          <div className="flex items-center gap-3">
            {dismiss && (
              <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
                <CircleXIcon size={16} />
              </Button>
            )}
            <Chip
              color="danger"
              variant="flat"
              startContent={<CircleXIcon size={14} />}
              className="pl-3 py-2"
            >
              Error
            </Chip>
            <span className="text-danger-700 font-semibold">Database error</span>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <p className="text-danger-600 select-text">
            {error ||
              "An error occurred while making the request. Please check your connection and try again."}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!results) return null;

  return (
    <Card shadow="sm" className="w-full max-w-full border border-default-200">
      <CardHeader className="flex justify-between items-center bg-default-50">
        <div className="flex items-center gap-3">
          {dismiss && (
            <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
              <CircleXIcon size={16} />
            </Button>
          )}
          <Chip
            color="success"
            variant="flat"
            startContent={<CheckCircle size={14} />}
            className="pl-3 py-2"
          >
            Success
          </Chip>
          {results.rows?.length || 0 > 0 ? (
            <span className="text-success-700 font-semibold">
              {results.rows!.length.toLocaleString()} {results.rows!.length == 1 ? "row" : "rows"}{" "}
              returned
            </span>
          ) : (
            <span className="text-default-700 font-semibold">Query successful</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {results.rowsRead && (
            <Tooltip content="Rows read">
              <div className="flex items-center gap-1 text-default-500">
                <Rows4Icon size={14} />

                <span className="text-sm select-text">
                  {results.rowsRead?.toLocaleString()} {results.rowsRead > 1 ? "rows" : "row"}
                </span>
              </div>
            </Tooltip>
          )}

          {results.bytesRead && (
            <Tooltip content="Bytes read">
              <div className="flex items-center gap-1 text-default-500">
                <HardDriveIcon size={14} />

                <span className="text-sm select-text">{formatBytes(results.bytesRead)}</span>
              </div>
            </Tooltip>
          )}

          <Tooltip content="Request duration">
            <div className="flex items-center gap-1 text-default-500">
              <Clock size={14} />
              <span className="text-sm select-text">
                {parseFloat(results.duration.toFixed(3))}ms
              </span>
            </div>
          </Tooltip>

          <span className="text-sm text-default-400 select-text">
            {results.time.toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="p-0">
        {error && <div className="bg-red-100 text-red-600 p-2 rounded">{error}</div>}

        {results && columns && (
          <div className="h-64 w-full">
            <ResultTable
              width={"100%"}
              columns={columns}
              results={results.rows || []}
              setColumns={setColumns}
              colorMode={colorMode}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default SQLResults;
