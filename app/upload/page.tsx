"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileImage,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { cn, parseFolderName } from "@/lib/utils";
import { ParsedFolder, UploadedFile } from "@/types";

interface UploadStatus {
  status: "idle" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  message: string;
}

export default function UploadPage() {
  const [folders, setFolders] = useState<ParsedFolder[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setErrors([]);

    // Group files by their folder structure
    const folderMap = new Map<string, File[]>();
    const newErrors: string[] = [];

    acceptedFiles.forEach((file) => {
      // Extract folder path from webkitRelativePath or file path
      const path = file.webkitRelativePath || file.name;
      const pathParts = path.split("/");

      if (pathParts.length < 2) {
        newErrors.push(`File ${file.name} is not in a proper folder structure`);
        return;
      }

      const folderName = pathParts[pathParts.length - 2]; // Get parent folder name

      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push(file);
    });

    // Parse folders and validate naming convention
    const parsedFolders: ParsedFolder[] = [];

    folderMap.forEach((files, folderName) => {
      const parsed = parseFolderName(folderName);

      if (!parsed) {
        newErrors.push(
          `Folder "${folderName}" doesn't follow the expected naming convention`
        );
        return;
      }

      // Filter only image files
      const imageFiles = files.filter(
        (file) =>
          file.type.startsWith("image/") ||
          /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
      );

      if (imageFiles.length === 0) {
        newErrors.push(`Folder "${folderName}" contains no image files`);
        return;
      }

      parsedFolders.push({
        name: folderName,
        blade: parsed.blade,
        side: parsed.side,
        files: imageFiles,
      });
    });

    setErrors(newErrors);
    setFolders(parsedFolders);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"],
    },
    multiple: true,
  });

  const BATCH_SIZE = 100;

  const handleUpload = async () => {
    if (folders.length === 0) return;

    const allFiles = folders.flatMap((folder) =>
      folder.files.map((file, index) => ({
        file,
        metadata: {
          blade: folder.blade,
          side: folder.side,
          folderName: folder.name,
          originalPath: file.webkitRelativePath || file.name,
        },
      }))
    );

    const totalFiles = allFiles.length;
    let uploadedFiles = 0;

    setUploadStatus({
      status: "uploading",
      progress: 0,
      message: "Uploading in batches...",
    });

    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      const formData = new FormData();

      batch.forEach((entry, idx) => {
        formData.append("files", entry.file);
        formData.append(`metadata_${idx}`, JSON.stringify(entry.metadata));
      });

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setUploadStatus({
          status: "error",
          progress: (uploadedFiles / totalFiles) * 100,
          message: `Batch ${i / BATCH_SIZE + 1} failed. Aborting.`,
        });
        return;
      }

      uploadedFiles += batch.length;

      setUploadStatus({
        status: "uploading",
        progress: Math.round((uploadedFiles / totalFiles) * 100),
        message: `Uploaded ${uploadedFiles} / ${totalFiles} images`,
      });
    }

    setUploadStatus({
      status: "complete",
      progress: 100,
      message: `All ${totalFiles} images uploaded successfully!`,
    });

    setTimeout(() => {
      window.location.href = "/turbine";
    }, 2000);
  };

  const removeFolderAt = (index: number) => {
    setFolders(folders.filter((_, i) => i !== index));
  };

  const getSideLabel = (side: string) => {
    const labels = {
      TE: "Trailing Edge",
      PS: "Pressure Side",
      LE: "Leading Edge",
      SS: "Suction Side",
    };
    return labels[side as keyof typeof labels] || side;
  };

  const getBladeCounts = () => {
    const counts = { A: 0, B: 0, C: 0 };
    folders.forEach((folder) => {
      counts[folder.blade] += folder.files.length;
    });
    return counts;
  };

  const getSideCounts = () => {
    const counts = { TE: 0, PS: 0, LE: 0, SS: 0 };
    folders.forEach((folder) => {
      counts[folder.side] += folder.files.length;
    });
    return counts;
  };

  const bladeCounts = getBladeCounts();
  const sideCounts = getSideCounts();
  const totalImages = folders.reduce(
    (acc, folder) => acc + folder.files.length,
    0
  );

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Upload Turbine Images</h1>
          <p className="text-muted-foreground">
            Upload folders containing turbine blade images following the DJI
            naming convention
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input
                {...getInputProps()}
                // @ts-ignore
                webkitdirectory=""
                // @ts-ignore
                directory=""
                multiple
              />
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive
                      ? "Drop folders here..."
                      : "Drag and drop image folders here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Or click to browse and select folders
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Expected folder format:
                  DJI_YYYYMMDD_NN_PREFIX-X-BLADE-SIDE-SUFFIX
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        {folders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Upload Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalImages}</div>
                  <div className="text-sm text-muted-foreground">
                    Total Images
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{folders.length}</div>
                  <div className="text-sm text-muted-foreground">Folders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {
                      Object.values(bladeCounts).filter((count) => count > 0)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Blades</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {
                      Object.values(sideCounts).filter((count) => count > 0)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Sides</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Blade Distribution</h4>
                  <div className="flex gap-2">
                    {Object.entries(bladeCounts).map(([blade, count]) => (
                      <Badge
                        key={blade}
                        variant={count > 0 ? "default" : "secondary"}
                      >
                        Blade {blade}: {count} images
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Side Distribution</h4>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(sideCounts).map(([side, count]) => (
                      <Badge
                        key={side}
                        variant={count > 0 ? "default" : "secondary"}
                      >
                        {getSideLabel(side)}: {count} images
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Folder List */}
        {folders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detected Folders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {folders.map((folder, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{folder.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {folder.files.length} images
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Blade {folder.blade}</Badge>
                      <Badge variant="outline">
                        {getSideLabel(folder.side)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFolderAt(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Status */}
        {uploadStatus.status !== "idle" && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {uploadStatus.status === "complete" && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {uploadStatus.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">{uploadStatus.message}</span>
                </div>
                {uploadStatus.status === "uploading" && (
                  <Progress value={uploadStatus.progress} className="w-full" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleUpload}
            disabled={
              folders.length === 0 || uploadStatus.status === "uploading"
            }
            size="lg"
            className="px-8"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload {totalImages} Images
          </Button>
        </div>
      </div>
    </div>
  );
}
