import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Tooltip,
  Divider,
  Button,
} from "@heroui/react";
import { Clock, CheckCircle, AlertCircle, Info, WifiOff, TrashIcon, Copy } from "lucide-react";
import JsonView from "@uiw/react-json-view";

import "../style.css";
import ResultTable from "../../common/ResultTable";

const renderBody = (body: string, headers: any) => {
  let contentType = headers["content-type"];
  if (contentType && contentType.includes("application/json")) {
    try {
      const jsonData = typeof body === "string" ? JSON.parse(body) : body;
      return (
        <JsonView
          value={jsonData}
          style={{ backgroundColor: "transparent", userSelect: "text" }}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
        />
      );
    } catch (error) {
      return <pre className="whitespace-pre-wrap break-words text-sm select-text">{body}</pre>;
    }
  }
  return <pre className="whitespace-pre-wrap break-words text-sm select-text">{body}</pre>;
};

const HttpResponse = ({ response, error, dismiss }: any) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (error) {
    return (
      <Card shadow="sm" className="w-full max-w-full border border-danger-200">
        <CardHeader className="flex justify-between items-center bg-danger-50">
          <div className="flex items-center gap-3">
            <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
              <TrashIcon size={16} />
            </Button>
            <Chip
              color="danger"
              variant="flat"
              startContent={<WifiOff size={14} />}
              className="pl-3 py-2"
            >
              Error
            </Chip>
            <span className="text-danger-700 font-semibold">Connection Error</span>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <p className="text-danger-600 select-text">
            {error.message ||
              "An error occurred while making the request. Please check your connection and try again."}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!response) {
    return null;
  }

  const { status, statusText, headers, data } = response;

  const headerEntries = Array.from(Object.entries(headers));

  const getStatusInfo = (status: any) => {
    if (status >= 200 && status < 300) return { color: "success", icon: CheckCircle };
    if (status >= 300 && status < 400) return { color: "warning", icon: Info };
    if (status >= 400) return { color: "danger", icon: AlertCircle };
    return { color: "default", icon: Info };
  };

  const statusInfo = getStatusInfo(status);

  return (
    <Card shadow="sm" className="http-response w-full max-w-full border border-default-200">
      <CardHeader className="flex justify-between items-center bg-default-50">
        <div className="flex items-center gap-3">
          <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
            <TrashIcon size={16} />
          </Button>
          <Chip
            color={statusInfo.color as any}
            variant="flat"
            startContent={<statusInfo.icon size={14} />}
            className="pl-3 py-2"
          >
            {status}
          </Chip>
          <span className="text-default-700 font-semibold select-text">{statusText}</span>
        </div>
        <div className="flex items-center gap-4">
          <Tooltip content="Request duration">
            <div className="flex items-center gap-1 text-default-500">
              <Clock size={14} />
              <span className="text-sm select-text">
                {parseFloat(response.duration.toFixed(3))}ms
              </span>
            </div>
          </Tooltip>
          <span className="text-sm text-default-400 select-text">
            {response.time.toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="p-4 space-y-4">
        {/* Response Headers Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-default-700">Response Headers</h3>
            <Button
              variant="light"
              size="sm"
              isIconOnly
              onClick={() => {
                const headersText = headerEntries
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n');
                copyToClipboard(headersText);
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
          <div className="bg-default-50 rounded-lg p-3">
            <ResultTable
              results={headerEntries}
              width={"100%"}
              columns={[
                {
                  id: "Header",
                  title: "Header",
                  grow: 1,
                },
                {
                  id: "Value",
                  title: "Value",
                  grow: 1,
                },
              ]}
            />
          </div>
        </div>

        {/* Response Body Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-default-700">Response Body</h3>
            <Button
              variant="light"
              size="sm"
              isIconOnly
              onClick={() => copyToClipboard(data)}
            >
              <Copy size={14} />
            </Button>
          </div>
          <div className="bg-default-50 rounded-lg p-4 overflow-auto max-h-96">
            {renderBody(data, headers)}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default HttpResponse;
